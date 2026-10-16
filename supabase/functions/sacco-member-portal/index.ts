import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const admin = createClient(URL, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const authClient = createClient(URL, ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info", "Access-Control-Allow-Methods": "POST, OPTIONS", "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" };
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: cors });
const clean = (v: unknown, max = 180) => String(v ?? "").trim().slice(0, max);
const digits = (v: unknown) => clean(v, 40).replace(/\D/g, "");
const lastNine = (v: unknown) => digits(v).slice(-9);
const normalizeCode = (v: unknown) => clean(v, 40).toUpperCase();
const validPin = (v: unknown) => /^\d{6,12}$/.test(String(v ?? ""));
const b64url = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
const randomToken = (n = 32) => { const b = crypto.getRandomValues(new Uint8Array(n)); return b64url(b); };
async function sha256(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return b64url(new Uint8Array(digest));
}
async function hashPin(pin: string, salt: string) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(pin), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt: Uint8Array.from(atob(salt.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((salt.length + 3) % 4)), c => c.charCodeAt(0)), iterations: 210000, hash: "SHA-256" }, key, 256);
  return b64url(new Uint8Array(bits));
}
function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
async function memberLookup(companyId: string, accountCode: string, phone: string) {
  if (!/^[0-9a-f-]{36}$/i.test(companyId) || !/^[A-Z0-9_-]{2,40}$/.test(accountCode) || lastNine(phone).length < 8) return null;
  const { data, error } = await admin.from("sacco_members").select("id,company_id,account_code,full_name,phone,email,avatar_url,joined_on,status").eq("company_id", companyId).eq("account_code", accountCode).limit(2);
  if (error || !data || data.length !== 1) return null;
  const m = data[0];
  if (m.status !== "active" || !m.phone || !safeEqual(lastNine(m.phone), lastNine(phone))) return null;
  return m;
}
async function checkAdmin(authHeader: string, companyId: string) {
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token || token === ANON_KEY) return false;
  const { data: userData, error: authError } = await authClient.auth.getUser(token);
  const user = userData?.user;
  if (authError || !user) return false;
  const { data: membership } = await admin.from("company_members").select("role,status").eq("company_id", companyId).eq("user_id", user.id).maybeSingle();
  if (membership?.status === "active" && ["owner", "admin", "manager"].includes(membership.role)) return true;
  const { data: saccoRole } = await admin.from("sacco_role_assignments").select("role").eq("company_id", companyId).eq("user_id", user.id).eq("role", "chairperson").maybeSingle();
  return membership?.status === "active" && saccoRole?.role === "chairperson";
}
async function credentialFor(m: {id:string;company_id:string}) {
  const { data, error } = await admin.from("sacco_member_portal_credentials").select("*").eq("company_id", m.company_id).eq("member_id", m.id).maybeSingle();
  if (error) throw error;
  return data;
}
async function verifyPin(cred: any, pin: string) {
  if (!cred?.pin_hash || !cred?.pin_salt || !validPin(pin)) return false;
  return safeEqual(await hashPin(pin, cred.pin_salt), cred.pin_hash);
}
async function createSession(m: any) {
  const token = randomToken(32), tokenHash = await sha256(token);
  const { error } = await admin.from("sacco_member_portal_sessions").insert({ company_id: m.company_id, member_id: m.id, token_hash: tokenHash, expires_at: new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString() });
  if (error) throw error;
  await admin.from("sacco_member_portal_credentials").update({ last_login_at: new Date().toISOString(), failed_attempts: 0, locked_until: null, updated_at: new Date().toISOString() }).eq("company_id", m.company_id).eq("member_id", m.id);
  return token;
}
async function sessionMember(token: string) {
  if (token.length < 32 || token.length > 256) return null;
  const tokenHash = await sha256(token);
  const { data: sess } = await admin.from("sacco_member_portal_sessions").select("id,company_id,member_id,expires_at").eq("token_hash", tokenHash).is("revoked_at", null).gt("expires_at", new Date().toISOString()).maybeSingle();
  if (!sess) return null;
  await admin.from("sacco_member_portal_sessions").update({ last_seen_at: new Date().toISOString() }).eq("id", sess.id);
  const { data: member } = await admin.from("sacco_members").select("id,company_id,account_code,full_name,phone,email,avatar_url,joined_on,status").eq("id", sess.member_id).eq("company_id", sess.company_id).maybeSingle();
  if (!member || member.status !== "active") return null;
  return { session: sess, member };
}
async function snapshot(m: any) {
  const [companyR, entriesR, termsR, withdrawalsR, reviewsR, preferencesR] = await Promise.all([
    admin.from("company_profiles").select("name,currency_code").eq("id", m.company_id).maybeSingle(),
    admin.from("sacco_savings_entries").select("id,entry_type,amount,transaction_date,payment_method,reference,notes,status,submitted_at,reviewed_at,rejection_reason,term_id").eq("company_id", m.company_id).eq("member_id", m.id).order("submitted_at", { ascending: false }).limit(100),
    admin.from("sacco_terms").select("id,term_name,starts_on,ends_on,status").eq("company_id", m.company_id).order("starts_on", { ascending: false }).limit(100),
    admin.from("sacco_withdrawal_requests").select("id,amount,payment_method,status,request_note,rejection_reason,requested_at,reviewed_at,approved_amount,paid_amount,paid_at,payment_reference,term_id").eq("company_id", m.company_id).eq("member_id", m.id).order("requested_at", { ascending: false }).limit(100),
    admin.from("sacco_member_reviews").select("id,term_id,review_type,message,created_at").eq("company_id", m.company_id).eq("member_id", m.id).order("created_at", { ascending: false }).limit(100),
    admin.from("sacco_member_portal_preferences").select("preferences").eq("company_id", m.company_id).eq("member_id", m.id).maybeSingle()
  ]);
  for (const r of [companyR, entriesR, termsR, withdrawalsR, reviewsR, preferencesR]) if (r.error) throw r.error;
  const entries = entriesR.data || [], terms = termsR.data || [], withdrawals = withdrawalsR.data || [], reviews = reviewsR.data || [];
  const confirmedBalance = entries.filter((x:any) => x.status === "confirmed").reduce((sum:number,x:any) => sum + (x.entry_type === "withdrawal" ? -Number(x.amount) : x.entry_type === "deposit" ? Number(x.amount) : 0), 0);
  const pendingSavings = entries.filter((x:any) => x.status === "pending" && x.entry_type === "deposit").reduce((sum:number,x:any) => sum + Number(x.amount), 0);
  const activeTerm = terms.find((t:any) => t.status === "active") || null;
  const now = new Date().toISOString();
  const { data: openElections, error: electionsError } = await admin.from("sacco_elections").select("id,title,starts_at,ends_at,status").eq("company_id",m.company_id).eq("status","open").lte("starts_at",now).gt("ends_at",now).order("ends_at",{ascending:true}).limit(10);
  if (electionsError) throw electionsError;
  const electionRows = openElections || [];
  let memberElections:any[] = [];
  if (electionRows.length) {
    const electionIds = electionRows.map((e:any)=>e.id);
    const [candidateR, voterR] = await Promise.all([
      admin.from("sacco_election_candidates").select("id,election_id,member_id").eq("company_id",m.company_id).in("election_id",electionIds),
      admin.from("sacco_election_votes").select("election_id").eq("company_id",m.company_id).eq("voter_member_id",m.id).in("election_id",electionIds)
    ]);
    if (candidateR.error) throw candidateR.error;
    if (voterR.error) throw voterR.error;
    const candidateRows = candidateR.data || [];
    const candidateMemberIds = [...new Set(candidateRows.map((c:any)=>c.member_id))];
    let candidateMembers:any[] = [];
    if (candidateMemberIds.length) {
      const memberR = await admin.from("sacco_members").select("id,full_name,account_code").eq("company_id",m.company_id).in("id",candidateMemberIds);
      if (memberR.error) throw memberR.error;
      candidateMembers = memberR.data || [];
    }
    const votedIds = new Set((voterR.data || []).map((v:any)=>v.election_id));
    memberElections = electionRows.map((e:any)=>({...e,voted:votedIds.has(e.id),candidates:candidateRows.filter((c:any)=>c.election_id===e.id).map((c:any)=>{const cm=candidateMembers.find((x:any)=>x.id===c.member_id);return {id:c.id,member_id:c.member_id,full_name:cm?.full_name||"Candidate",account_code:cm?.account_code||""}})}));
  }
  return {
    company: companyR.data || { name: "Savings circle", currency_code: "UGX" },
    member: { id:m.id, account_code:m.account_code, full_name:m.full_name, phone:m.phone, email:m.email, avatar_url:m.avatar_url, joined_on:m.joined_on },
    summary: { confirmed_balance: confirmedBalance, pending_savings: pendingSavings, confirmed_deposits: entries.filter((x:any)=>x.status==="confirmed"&&x.entry_type==="deposit").reduce((s:number,x:any)=>s+Number(x.amount),0), active_term:activeTerm, pending_withdrawals:withdrawals.filter((x:any)=>x.status==="pending").length },
    entries, terms, withdrawals, reviews, elections:memberElections,
    preferences: preferencesR.data?.preferences || { theme:"glass", wallpaper:"midnight", font_style:"system", display_density:"comfortable" }
  };
}

async function electionAdminList(companyId: string) {
  const { data: electionRows, error: electionsError } = await admin.from("sacco_elections").select("id,company_id,title,starts_at,ends_at,status,created_by,closed_at,winner_member_id,winner_votes,created_at").eq("company_id",companyId).order("created_at",{ascending:false}).limit(50);
  if (electionsError) throw electionsError;
  const elections = electionRows || [];
  if (!elections.length) return [];
  const ids = elections.map((e:any)=>e.id);
  const [candidateR,votesR] = await Promise.all([
    admin.from("sacco_election_candidates").select("id,election_id,member_id").eq("company_id",companyId).in("election_id",ids),
    admin.from("sacco_election_votes").select("election_id,candidate_id").eq("company_id",companyId).in("election_id",ids)
  ]);
  if (candidateR.error) throw candidateR.error;
  if (votesR.error) throw votesR.error;
  const candidates = candidateR.data || [], votes = votesR.data || [];
  const memberIds = [...new Set([...candidates.map((c:any)=>c.member_id),...elections.map((e:any)=>e.winner_member_id).filter(Boolean)])];
  let members:any[] = [];
  if (memberIds.length) {
    const {data,error}=await admin.from("sacco_members").select("id,full_name,account_code,status,portal_user_id").eq("company_id",companyId).in("id",memberIds);
    if(error)throw error;
    members=data||[];
  }
  return elections.map((e:any)=>{
    const rows=candidates.filter((c:any)=>c.election_id===e.id);
    const candidatesForElection=rows.map((c:any)=>{
      const m=members.find((x:any)=>x.id===c.member_id);
      return {id:c.id,member_id:c.member_id,full_name:m?.full_name||"Candidate",account_code:m?.account_code||"",status:m?.status||"unknown",votes:e.status==="closed"?votes.filter((v:any)=>v.election_id===e.id&&v.candidate_id===c.id).length:null};
    });
    const winner=members.find((m:any)=>m.id===e.winner_member_id);
    return {...e,winner_name:winner?.full_name||null,total_votes:e.status==="closed"?votes.filter((v:any)=>v.election_id===e.id).length:null,candidates:candidatesForElection};
  });
}
async function rateLimit(req: Request, companyId: string, accountCode: string, phone: string) {
  const ip = clean(req.headers.get("cf-connecting-ip") || req.headers.get("x-forwarded-for")?.split(",")[0] || "unknown", 100);
  const key = await sha256([companyId, accountCode, lastNine(phone), ip].join("|"));
  const { data } = await admin.from("sacco_member_portal_attempts").select("*").eq("lookup_hash", key).maybeSingle();
  const now = Date.now();
  if (data?.locked_until && new Date(data.locked_until).getTime() > now) return { key, blocked: true };
  if (data && now - new Date(data.window_started_at).getTime() < 15 * 60 * 1000 && data.attempts >= 5) {
    await admin.from("sacco_member_portal_attempts").update({ locked_until: new Date(now + 15 * 60 * 1000).toISOString(), updated_at: new Date().toISOString() }).eq("lookup_hash", key);
    return { key, blocked: true };
  }
  return { key, blocked: false, data };
}
async function recordFailure(rate: any) {
  const now = new Date();
  const sameWindow = rate.data && now.getTime() - new Date(rate.data.window_started_at).getTime() < 15 * 60 * 1000;
  const attempts = sameWindow ? Number(rate.data.attempts || 0) + 1 : 1;
  const payload = { lookup_hash: rate.key, attempts, window_started_at: sameWindow ? rate.data.window_started_at : now.toISOString(), locked_until: attempts >= 5 ? new Date(now.getTime() + 15 * 60 * 1000).toISOString() : null, updated_at: now.toISOString() };
  await admin.from("sacco_member_portal_attempts").upsert(payload, { onConflict: "lookup_hash" });
}
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return reply({ ok:false, message:"Use POST for this endpoint." }, 405);
  try {
    const body = await req.json();
    const action = clean(body.action, 40);
    const companyId = clean(body.companyId, 80);
    if (!/^[0-9a-f-]{36}$/i.test(companyId)) return reply({ ok:false, message:"The shared portal link is missing a valid circle reference." }, 400);


    if (action === "manage-election") {
      const operation = clean(body.operation,40);
      const authHeader = req.headers.get("authorization") || "";
      const token = authHeader.replace(/^Bearer\\s+/i,"").trim();
      if (!token || token === ANON_KEY) return reply({ok:false,message:"Sign in to manage circle elections."},401);
      const {data:authData,error:authError}=await authClient.auth.getUser(token);
      const actor=authData?.user;
      if(authError||!actor)return reply({ok:false,message:"Your staff session is not valid. Sign in again."},401);
      const {data:membership,error:membershipError}=await admin.from("company_members").select("role,status").eq("company_id",companyId).eq("user_id",actor.id).maybeSingle();
      if(membershipError||membership?.status!=="active")return reply({ok:false,message:"You are not an active member of this circle workspace."},403);
      const canManage=await checkAdmin(authHeader,companyId);
      if(operation!=="list"&&!canManage)return reply({ok:false,message:"Only an owner, admin, manager or assigned chairperson can manage elections."},403);
      if(operation==="list")return reply({ok:true,elections:await electionAdminList(companyId)});
      if(operation==="create"){
        const title=clean(body.title,180),startsAt=clean(body.startsAt,80),endsAt=clean(body.endsAt,80);
        const startMs=Date.parse(startsAt),endMs=Date.parse(endsAt);
        if(title.length<3)return reply({ok:false,message:"Give the election a clear title."},400);
        if(!Number.isFinite(startMs)||!Number.isFinite(endMs)||endMs<=startMs||endMs<=Date.now())return reply({ok:false,message:"Choose a valid future election window; the end must be after the start."},400);
        const {data,error}=await admin.from("sacco_elections").insert({company_id:companyId,title,starts_at:new Date(startMs).toISOString(),ends_at:new Date(endMs).toISOString(),status:"draft",created_by:actor.id}).select("id").single();
        if(error)throw error;
        return reply({ok:true,message:"Election created as a draft. Nominate at least two active members before opening it.",elections:await electionAdminList(companyId),electionId:data.id});
      }
      if(operation==="nominate"){
        const electionId=clean(body.electionId,80),memberId=clean(body.memberId,80);
        const {data:election,error:electionError}=await admin.from("sacco_elections").select("id,status").eq("company_id",companyId).eq("id",electionId).maybeSingle();
        if(electionError)throw electionError;
        if(!election||election.status!=="draft")return reply({ok:false,message:"Candidates can only be added to a draft election."},400);
        const {data:member,error:memberError}=await admin.from("sacco_members").select("id,status").eq("company_id",companyId).eq("id",memberId).maybeSingle();
        if(memberError)throw memberError;
        if(!member||member.status!=="active")return reply({ok:false,message:"Choose an active member of this circle."},400);
        const {error}=await admin.from("sacco_election_candidates").insert({company_id:companyId,election_id:electionId,member_id:memberId,nominated_by:actor.id});
        if(error&&error.code==="23505")return reply({ok:false,message:"That member is already nominated for this election."},409);
        if(error)throw error;
        return reply({ok:true,message:"Candidate added to the draft election.",elections:await electionAdminList(companyId)});
      }
      if(operation==="open"){
        const electionId=clean(body.electionId,80);
        const {data:election,error}=await admin.from("sacco_elections").select("id,status,starts_at,ends_at").eq("company_id",companyId).eq("id",electionId).maybeSingle();
        if(error)throw error;
        if(!election||election.status!=="draft")return reply({ok:false,message:"Only a draft election can be opened."},400);
        if(new Date(election.ends_at).getTime()<=Date.now())return reply({ok:false,message:"The election end time has already passed."},400);
        const {count,error:countError}=await admin.from("sacco_election_candidates").select("id",{count:"exact",head:true}).eq("company_id",companyId).eq("election_id",electionId);
        if(countError)throw countError;
        if((count||0)<2)return reply({ok:false,message:"Nominate at least two active members before opening an election."},400);
        const {error:updateError}=await admin.from("sacco_elections").update({status:"open",updated_at:new Date().toISOString()}).eq("company_id",companyId).eq("id",electionId);
        if(updateError)throw updateError;
        return reply({ok:true,message:"Election opened. Eligible members can now vote once from their private member portal.",elections:await electionAdminList(companyId)});
      }
      if(operation==="close"){
        const electionId=clean(body.electionId,80);
        const {data:election,error}=await admin.from("sacco_elections").select("id,status").eq("company_id",companyId).eq("id",electionId).maybeSingle();
        if(error)throw error;
        if(!election||election.status!=="open")return reply({ok:false,message:"Only an open election can be closed."},400);
        const {data:ballots,error:ballotError}=await admin.from("sacco_election_votes").select("candidate_id").eq("company_id",companyId).eq("election_id",electionId);
        if(ballotError)throw ballotError;
        const counts=new Map<string,number>();
        for(const ballot of (ballots||[]))counts.set(ballot.candidate_id,(counts.get(ballot.candidate_id)||0)+1);
        const highest=Math.max(0,...counts.values()),leaders=[...counts.entries()].filter(([,votes])=>votes===highest&&votes>0);
        let winnerMember:any=null,chairpersonRoleUpdated=false;
        if(leaders.length===1){
          const {data:candidate,error:candidateError}=await admin.from("sacco_election_candidates").select("member_id").eq("company_id",companyId).eq("election_id",electionId).eq("id",leaders[0][0]).maybeSingle();
          if(candidateError)throw candidateError;
          if(candidate){
            const {data:member,error:memberError}=await admin.from("sacco_members").select("id,full_name,portal_user_id").eq("company_id",companyId).eq("id",candidate.member_id).maybeSingle();
            if(memberError)throw memberError;
            winnerMember=member||null;
          }
        }
        const {error:updateError}=await admin.from("sacco_elections").update({status:"closed",closed_at:new Date().toISOString(),winner_member_id:winnerMember?.id||null,winner_votes:leaders.length===1?highest:null,updated_at:new Date().toISOString()}).eq("company_id",companyId).eq("id",electionId);
        if(updateError)throw updateError;
        if(winnerMember?.portal_user_id){
          const {data:linkedMembership}=await admin.from("company_members").select("status").eq("company_id",companyId).eq("user_id",winnerMember.portal_user_id).maybeSingle();
          if(linkedMembership?.status==="active"){
            const {data:existingRole,error:existingError}=await admin.from("sacco_role_assignments").select("id").eq("company_id",companyId).eq("user_id",winnerMember.portal_user_id).eq("role","chairperson").maybeSingle();
            if(existingError)throw existingError;
            if(!existingRole){const {error:roleInsertError}=await admin.from("sacco_role_assignments").insert({company_id:companyId,user_id:winnerMember.portal_user_id,role:"chairperson",assigned_by:actor.id});if(roleInsertError)throw roleInsertError}
            const {error:roleDeleteError}=await admin.from("sacco_role_assignments").delete().eq("company_id",companyId).eq("role","chairperson").neq("user_id",winnerMember.portal_user_id);
            if(roleDeleteError)throw roleDeleteError;
            chairpersonRoleUpdated=true;
          }
        }
        const message=winnerMember?(chairpersonRoleUpdated?"Election closed. "+winnerMember.full_name+" won and the chairperson role was updated.":"Election closed. "+winnerMember.full_name+" won; link their member account to an active staff login to automatically assign chairperson access."):(highest>0?"Election closed in a tie. The chairperson must resolve the tie before changing the role.":"Election closed with no votes; no chairperson role was changed.");
        return reply({ok:true,message,elections:await electionAdminList(companyId),chairpersonRoleUpdated});
      }
      return reply({ok:false,message:"Unknown election operation."},400);
    }

    if (action === "issue-enrollment-code") {
      if (!await checkAdmin(req.headers.get("authorization") || "", companyId)) return reply({ ok:false, message:"Only an authorized circle manager or chairperson can issue setup codes." }, 403);
      const memberId = clean(body.memberId, 80);
      const { data: member, error } = await admin.from("sacco_members").select("id,company_id,account_code,full_name,phone,status").eq("id", memberId).eq("company_id", companyId).maybeSingle();
      if (error || !member || member.status !== "active") return reply({ ok:false, message:"Active member account not found." }, 404);
      if (!member.phone || digits(member.phone).length < 8) return reply({ ok:false, message:"Add and verify a valid phone number on this member account before issuing portal access." }, 400);
      const code = randomToken(12);
      const { error: saveError } = await admin.from("sacco_member_portal_credentials").upsert({ company_id:companyId, member_id:memberId, enrollment_code_hash:await sha256(code), enrollment_expires_at:new Date(Date.now()+24*60*60*1000).toISOString(), updated_at:new Date().toISOString() }, { onConflict:"company_id,member_id" });
      if (saveError) throw saveError;
      return reply({ ok:true, enrollmentCode:code, expiresAt:new Date(Date.now()+24*60*60*1000).toISOString(), memberName:member.full_name, accountCode:member.account_code });
    }

    if (action === "complete-enrollment") {
      const accountCode = normalizeCode(body.accountCode), phone = clean(body.phone,40), code = clean(body.enrollmentCode,100), pin = String(body.pin ?? "");
      if (!validPin(pin)) return reply({ ok:false, message:"Choose a PIN containing 6–12 digits." }, 400);
      const rate = await rateLimit(req,companyId,accountCode,phone);
      if (rate.blocked) return reply({ ok:false, message:"Too many attempts. Wait 15 minutes before trying again." }, 429);
      const member = await memberLookup(companyId,accountCode,phone);
      const cred = member ? await credentialFor(member) : null;
      const codeHash = await sha256(code || "invalid-enrollment-code");
      if (!member || !cred?.enrollment_code_hash || !cred.enrollment_expires_at || new Date(cred.enrollment_expires_at).getTime() < Date.now() || !safeEqual(codeHash,cred.enrollment_code_hash)) {
        await recordFailure(rate); return reply({ ok:false, message:"We couldn't verify those details. Check them or contact your circle manager." }, 401);
      }
      const salt = randomToken(16), pinHash = await hashPin(pin,salt);
      const { error } = await admin.from("sacco_member_portal_credentials").update({ pin_salt:salt,pin_hash:pinHash,enrollment_code_hash:null,enrollment_expires_at:null,failed_attempts:0,locked_until:null,updated_at:new Date().toISOString() }).eq("company_id",companyId).eq("member_id",member.id);
      if (error) throw error;
      await admin.from("sacco_member_portal_attempts").delete().eq("lookup_hash",rate.key);
      const token = await createSession(member);
      return reply({ ok:true, sessionToken:token, account:await snapshot(member) });
    }

    if (action === "login") {
      const accountCode = normalizeCode(body.accountCode), phone = clean(body.phone,40), pin = String(body.pin ?? "");
      const rate = await rateLimit(req,companyId,accountCode,phone);
      if (rate.blocked) return reply({ ok:false, message:"Too many attempts. Wait 15 minutes before trying again." }, 429);
      const member = await memberLookup(companyId,accountCode,phone);
      const cred = member ? await credentialFor(member) : null;
      const valid = member && cred && !cred.locked_until || (member && cred && new Date(cred.locked_until).getTime() < Date.now());
      if (!member || !cred?.pin_hash || !cred?.pin_salt || !valid || !await verifyPin(cred,pin)) {
        await recordFailure(rate); return reply({ ok:false, message:"We couldn't verify those details. Check your account code, phone and PIN, or contact your circle manager." }, 401);
      }
      await admin.from("sacco_member_portal_attempts").delete().eq("lookup_hash",rate.key);
      const token = await createSession(member);
      return reply({ ok:true, sessionToken:token, account:await snapshot(member) });
    }

    const token = clean(body.sessionToken,256);
    const current = await sessionMember(token);
    if (!current || current.member.company_id !== companyId) return reply({ ok:false, message:"Your member session expired. Please sign in again." }, 401);
    const member = current.member;
    if (action === "vote-election") {
      const electionId=clean(body.electionId,80),candidateId=clean(body.candidateId,80),now=new Date().toISOString();
      const {data:election,error:electionError}=await admin.from("sacco_elections").select("id,starts_at,ends_at,status").eq("company_id",companyId).eq("id",electionId).eq("status","open").lte("starts_at",now).gt("ends_at",now).maybeSingle();
      if(electionError)throw electionError;
      if(!election)return reply({ok:false,message:"This election is not open for voting."},400);
      const {data:candidate,error:candidateError}=await admin.from("sacco_election_candidates").select("id").eq("company_id",companyId).eq("election_id",electionId).eq("id",candidateId).maybeSingle();
      if(candidateError)throw candidateError;
      if(!candidate)return reply({ok:false,message:"Choose a candidate in this election."},400);
      const {error:voteError}=await admin.from("sacco_election_votes").insert({company_id:companyId,election_id:electionId,voter_member_id:member.id,candidate_id:candidateId});
      if(voteError&&voteError.code==="23505")return reply({ok:false,message:"Your vote has already been recorded for this election."},409);
      if(voteError)throw voteError;
      return reply({ok:true,message:"Your vote has been recorded privately.",account:await snapshot(member)});
    }
    if (action === "dashboard") return reply({ ok:true, account:await snapshot(member) });
    if (action === "logout") {
      await admin.from("sacco_member_portal_sessions").update({ revoked_at:new Date().toISOString() }).eq("id",current.session.id);
      return reply({ ok:true });
    }
    if (action === "update-profile") {
      const cred = await credentialFor(member);
      if (!await verifyPin(cred,String(body.currentPin ?? ""))) return reply({ ok:false,message:"Enter your current PIN to update contact details." },401);
      const email = clean(body.email,254), phone = clean(body.phone,40);
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return reply({ok:false,message:"Enter a valid email address."},400);
      if (!phone || digits(phone).length < 8 || digits(phone).length > 18) return reply({ok:false,message:"Enter a valid phone number."},400);
      const preferences = body.preferences && typeof body.preferences === "object" ? body.preferences : {};
      const allowed = {
        theme:["glass","dark","light"].includes(preferences.theme)?preferences.theme:"glass",
        wallpaper:["midnight","forest","sunrise","ocean"].includes(preferences.wallpaper)?preferences.wallpaper:"midnight",
        font_style:["system","rounded","mono","serif"].includes(preferences.font_style)?preferences.font_style:"system",
        display_density:["comfortable","compact"].includes(preferences.display_density)?preferences.display_density:"comfortable"
      };
      const { error: memberError } = await admin.from("sacco_members").update({ email:email||null, phone, updated_at:new Date().toISOString() }).eq("id",member.id).eq("company_id",companyId);
      if (memberError) throw memberError;
      const { error: prefError } = await admin.from("sacco_member_portal_preferences").upsert({ company_id:companyId,member_id:member.id,preferences:allowed,updated_at:new Date().toISOString() },{onConflict:"company_id,member_id"});
      if (prefError) throw prefError;
      return reply({ok:true,account:await snapshot({...member,email:email||null,phone})});
    }
    if (action === "change-pin") {
      const cred = await credentialFor(member);
      if (!await verifyPin(cred,String(body.currentPin ?? ""))) return reply({ok:false,message:"Current PIN is incorrect."},401);
      const newPin = String(body.newPin ?? "");
      if (!validPin(newPin)) return reply({ok:false,message:"Your new PIN must contain 6–12 digits."},400);
      const salt = randomToken(16);
      const { error } = await admin.from("sacco_member_portal_credentials").update({pin_salt:salt,pin_hash:await hashPin(newPin,salt),updated_at:new Date().toISOString()}).eq("company_id",companyId).eq("member_id",member.id);
      if (error) throw error;
      return reply({ok:true,message:"Your PIN has been updated."});
    }
    return reply({ok:false,message:"Unknown portal action."},400);
  } catch (error) {
    console.error("SACCO member portal error", error);
    return reply({ok:false,message:"The member portal couldn't complete that request. Try again or contact your circle manager."},500);
  }
});