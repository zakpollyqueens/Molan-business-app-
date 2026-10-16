(() => {
 const slug='freelance-independent-professional';
 const $=id=>document.getElementById(id);
 function notice(message,state='info'){$('notice').textContent=message;$('notice').dataset.state=state}
 function openFeature(feature){
  const runtime=window.MolanProfileRuntime;
  if(typeof runtime?.openFeature!=='function'){notice('The profile page is loaded, but the authenticated app bridge is not connected. Open this profile from the signed-in Molan Business workspace.', 'warning');return}
  try{runtime.openFeature({profile:slug,profileName:'Freelance / independent professional',feature})}
  catch(error){notice(error.message||'Could not open this feature.','warning')}
 }
 fetch('profile.json',{cache:'no-cache'}).then(response=>{if(!response.ok)throw new Error('Profile configuration could not be loaded.');return response.json()}).then(profile=>{
  if(profile.slug!==slug||!Array.isArray(profile.features))throw new Error('Profile identity or feature list is invalid.');
  $('count').textContent=String(profile.features.length);
  $('status').textContent=typeof window.MolanProfileRuntime?.openFeature==='function'?'Authenticated workspace connection detected':'Profile ready; open it through the signed-in app to use connected features.';
  profile.features.forEach((feature,index)=>{const button=document.createElement('button');button.type='button';button.className='feature';const number=document.createElement('span');number.textContent=String(index+1).padStart(2,'0');const title=document.createElement('strong');title.textContent=feature.title;button.append(number,title);button.addEventListener('click',()=>openFeature(feature));$('features').append(button)});
 }).catch(error=>notice(error.message||'Could not load this profile.','warning'));
})();