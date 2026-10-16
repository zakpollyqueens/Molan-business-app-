/* Shared runtime registry for all 51 Molan Business profiles.
 * Profile-specific configuration lives in /business-profiles/<slug>/profile.json.
 * Shared rendering, navigation, styling and database wiring stay in the application root.
 */
(() => {
  const fallbackCatalog = [["Grocery shop","Grocery shops","Daily essentials, stock, suppliers and cash sales.","▤"],["Retail shop","Retail shops","Products, stock control, sales and customer records.","◈"],["Wholesale business","Wholesale businesses","Bulk orders, supplier pricing and inventory.","▦"],["Supermarket","Supermarkets","Departments, stock movement, sales and staff.","▤"],["Boutique / clothing shop","Boutiques and clothing shops","Fashion inventory, sizes, sales and suppliers.","✦"],["Electronics shop","Electronics shops","Devices, serial tracking, warranties and sales.","⌁"],["Hardware shop","Hardware shops","Building supplies, inventory and contractor orders.","▧"],["Pharmacy","Pharmacies","Stock batches, expiry checks and sales workflows.","✚"],["Agricultural input shop","Agricultural input shops","Seeds, fertilizers, farm supplies and seasonal stock.","❋"],["Mobile money / airtime","Mobile money and airtime shops","Agent operations, float tracking and daily reconciliation.","↗"],["Restaurant","Restaurants","Menus, orders, kitchen operations and customers.","♨"],["Hotel / guesthouse","Hotels and guesthouses","Bookings, rooms, guests and service operations.","⌂"],["Bar / beverage shop","Bars and beverage shops","Beverage inventory, sales and supplier records.","◉"],["Bakery","Bakeries","Production batches, ingredients, orders and sales.","♨"],["Catering business","Catering businesses","Event orders, menus, procurement and delivery.","✦"],["Cafe / coffee shop","Cafés and coffee shops","Menu, orders, stock and customer experience.","☕"],["Crop farming","Crop farming","Planting cycles, inputs, harvests and sales.","❋"],["Livestock farming","Livestock farming","Herd records, feeding, health and production.","♧"],["Poultry farming","Poultry farming","Flock cycles, feed, eggs and mortality records.","♧"],["Fish farming","Fish farming","Ponds, stocking, feeding, harvest and sales.","≈"],["Agro-processing","Agro-processing","Raw materials, processing, batches and distribution.","⚙"],["Manufacturing","Manufacturing","Production planning, materials, quality and orders.","⚙"],["SACCO savings group","SACCO savings groups","Group savings, member contributions, welfare, balances and withdrawal approvals.","♧"],["Investment group","Investment groups","Member contributions, projects and investment reporting.","↗"],["Microfinance business","Microfinance businesses","Client accounts, lending workflows and repayments.","＝"],["Insurance agency","Insurance agencies","Clients, policies, renewals and commissions.","▣"],["Cooperative","Cooperatives","Membership, contributions, governance and reporting.","♙"],["Boda-boda business","Boda-boda businesses","Riders, trips, maintenance and collections.","↗"],["Taxi / minibus business","Taxi and minibus businesses","Vehicles, routes, drivers and collections.","▤"],["Trucking / logistics","Trucking and logistics","Fleet, consignments, dispatch and delivery tracking.","⇢"],["Vehicle hire / rental","Vehicle hire and rental","Bookings, fleet availability and rental records.","⌁"],["Vehicle repair garage","Vehicle repair garages","Job cards, parts, technicians and customer updates.","⚙"],["School","Schools","Learners, classes, assessments, fees and attendance.","▦"],["College / training centre","Colleges and training centres","Courses, enrolments, assessments and fees.","▦"],["Clinic / medical centre","Clinics and medical centres","Appointments, service records and operations.","✚"],["Dental practice","Dental practices","Appointments, treatment schedules and patient follow-up.","✚"],["Laboratory","Laboratories","Test requests, sample workflow and results tracking.","⌕"],["Real estate agency","Real estate agencies","Listings, leads, viewings and property transactions.","⌂"],["Landlord / property manager","Landlords and property managers","Tenants, rent tracking, maintenance and leases.","⌂"],["Construction company","Construction companies","Projects, site tasks, materials and contractors.","▧"],["Building contractor","Hardware and building contractors","Contracts, project stages, supplies and crews.","▧"],["Salon / barbershop","Salons and barbershops","Bookings, services, staff and retail products.","✂"],["Fashion / tailoring","Fashion and tailoring businesses","Measurements, orders, materials and delivery dates.","✦"],["Cleaning service","Cleaning services","Bookings, work schedules, teams and job completion.","✧"],["Security company","Security companies","Guard assignments, rosters, incidents and attendance.","◉"],["Consultancy / accounting firm","Consultancy and accounting firms","Clients, engagements, deadlines and deliverables.","＝"],["Freelance / independent professional","Freelancers and independent professionals","Client projects, service delivery, quotes, invoices, portfolios and professional reporting.","✦"],["ICT / software company","ICT and software companies","Projects, releases, support and technical teams.","⌘"],["Printing / stationery business","Printing and stationery businesses","Print jobs, stationery stock, quotes and deliveries.","▤"],["NGO / community organization","NGOs and community organizations","Programs, beneficiaries, activities and grant reporting.","♡"]];
  let catalog = fallbackCatalog;
  let byName = Object.create(null);
  const slugify = value => String(value || '').toLowerCase().normalize('NFKD').replace(/[^\w\s-]/g, '').trim().replace(/[\s_]+/g, '-').replace(/-+/g, '-');
  async function load() {
    const existing = await Promise.all(fallbackCatalog.map(async fallback => {
      const slug = slugify(fallback[0]);
      try {
        const response = await fetch('business-profiles/' + slug + '/profile.json', { cache: 'no-cache' });
        if (!response.ok) throw new Error('Profile configuration unavailable: ' + slug);
        const config = await response.json();
        if (!config || config.slug !== slug || config.name !== fallback[0] || !Array.isArray(config.features)) throw new Error('Invalid profile configuration: ' + slug);
        return { fallback, config };
      } catch (error) {
        console.warn('[Molan Business] Using built-in configuration for', slug, error);
        return { fallback, config: null };
      }
    }));
    const loaded = existing.map(item => {
      const p = item.config;
      if (p && p.slug !== 'sacco-savings-group') p.features = (p.features || []).filter(feature => feature.route !== 'sacco' && feature.route !== 'sacco-welfare');
      const config = p || { name:item.fallback[0], slug:slugify(item.fallback[0]), plural:item.fallback[1], description:item.fallback[2], icon:item.fallback[3], features:[] };
      return { config, fallback:item.fallback, extended:false };
    });
    try {
      const response = await fetch('business-profiles/extended-catalog.json', { cache: 'no-cache' });
      if (!response.ok) throw new Error('Extended business profile catalogue could not be loaded.');
      const data = await response.json();
      if (!Array.isArray(data.profiles) || data.profiles.length !== 500) throw new Error('Extended catalogue must contain exactly 500 profiles.');
      data.profiles.forEach(profile => {
        if (!profile || !profile.slug || !profile.name || !Array.isArray(profile.features)) return;
        profile.extended = true;
        loaded.push({ config:profile, fallback:[profile.name,profile.plural,profile.description,profile.icon], extended:true });
      });
    } catch (error) {
      console.error('[Molan Business] The 500-profile catalogue did not load:', error);
    }
    catalog = loaded.map(item => [item.config.name, item.config.plural || item.config.name, item.config.description || '', item.config.icon || '◈']);
    byName = Object.create(null);
    loaded.forEach(item => { byName[item.config.name] = item.config; });
    const bindSearchableSelect = (selectId, searchId, countId) => {
      const select = document.getElementById(selectId);
      if (!select) return;
      const previous = select.value;
      select.replaceChildren(new Option('Choose your business type', ''));
      catalog.forEach(profile => select.add(new Option(profile[0], profile[0])));
      if (previous && byName[previous]) select.value = previous;
      const search = document.getElementById(searchId);
      const resultCount = document.getElementById(countId);
      const filterOptions = () => {
        const query = String(search?.value || '').trim().toLocaleLowerCase();
        let matches = 0;
        [...select.options].forEach((option, index) => {
          if (index === 0) { option.hidden = false; return; }
          const profile = byName[option.value];
          const haystack = [option.text, profile?.plural, profile?.description, profile?.group, profile?.specialty].join(' ').toLocaleLowerCase();
          const show = !query || haystack.includes(query) || option.value === select.value;
          option.hidden = !show;
          if (show && option.value !== select.value) matches++;
        });
        if (resultCount) resultCount.textContent = query ? (matches + (select.value && byName[select.value] ? 1 : 0)) + ' matching business types' : catalog.length + ' business types available';
      };
      if (search && !search.dataset.profileSearchBound) {
        search.addEventListener('input', filterOptions);
        select.addEventListener('change', filterOptions);
        search.dataset.profileSearchBound = 'true';
      }
      filterOptions();
    };
    bindSearchableSelect('guided-business-type', 'guided-business-type-search', 'guided-business-type-results');
    bindSearchableSelect('business-category', 'business-category-search', 'business-category-results');
    const counter = document.getElementById('profile-catalogue-count-number');
    if (counter) counter.textContent = String(catalog.length);
    return catalog;
  }
  window.MolanBusinessProfiles = {
    get catalog() { return catalog; },
    get byName() { return byName; },
    load,
    slugify
  };
})();
