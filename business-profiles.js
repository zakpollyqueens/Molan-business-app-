/* Shared runtime registry for all 51 Molan Business profiles.
 * Profile-specific configuration lives in /business-profiles/<slug>/profile.json.
 * Shared rendering, navigation, styling and database wiring stay in the application root.
 */
(() => {
  const fallbackCatalog = [["Grocery shop","Grocery shops","Daily essentials, stock, suppliers and cash sales.","▤"],["Retail shop","Retail shops","Products, stock control, sales and customer records.","◈"],["Wholesale business","Wholesale businesses","Bulk orders, supplier pricing and inventory.","▦"],["Supermarket","Supermarkets","Departments, stock movement, sales and staff.","▤"],["Boutique / clothing shop","Boutiques and clothing shops","Fashion inventory, sizes, sales and suppliers.","✦"],["Electronics shop","Electronics shops","Devices, serial tracking, warranties and sales.","⌁"],["Hardware shop","Hardware shops","Building supplies, inventory and contractor orders.","▧"],["Pharmacy","Pharmacies","Stock batches, expiry checks and sales workflows.","✚"],["Agricultural input shop","Agricultural input shops","Seeds, fertilizers, farm supplies and seasonal stock.","❋"],["Mobile money / airtime","Mobile money and airtime shops","Agent operations, float tracking and daily reconciliation.","↗"],["Restaurant","Restaurants","Menus, orders, kitchen operations and customers.","♨"],["Hotel / guesthouse","Hotels and guesthouses","Bookings, rooms, guests and service operations.","⌂"],["Bar / beverage shop","Bars and beverage shops","Beverage inventory, sales and supplier records.","◉"],["Bakery","Bakeries","Production batches, ingredients, orders and sales.","♨"],["Catering business","Catering businesses","Event orders, menus, procurement and delivery.","✦"],["Cafe / coffee shop","Cafés and coffee shops","Menu, orders, stock and customer experience.","☕"],["Crop farming","Crop farming","Planting cycles, inputs, harvests and sales.","❋"],["Livestock farming","Livestock farming","Herd records, feeding, health and production.","♧"],["Poultry farming","Poultry farming","Flock cycles, feed, eggs and mortality records.","♧"],["Fish farming","Fish farming","Ponds, stocking, feeding, harvest and sales.","≈"],["Agro-processing","Agro-processing","Raw materials, processing, batches and distribution.","⚙"],["Manufacturing","Manufacturing","Production planning, materials, quality and orders.","⚙"],["SACCO","SACCOs","Members, savings, terms, approvals and withdrawals.","♧"],["SACCO savings group","SACCO savings groups","Group savings, member contributions, welfare, balances and withdrawal approvals.","♧"],["Savings circle / village savings group","Savings circles and village savings groups","Member contributions, welfare and group reconciliation.","♧"],["Investment group","Investment groups","Member contributions, projects and investment reporting.","↗"],["Microfinance business","Microfinance businesses","Client accounts, lending workflows and repayments.","＝"],["Insurance agency","Insurance agencies","Clients, policies, renewals and commissions.","▣"],["Cooperative","Cooperatives","Membership, contributions, governance and reporting.","♙"],["Boda-boda business","Boda-boda businesses","Riders, trips, maintenance and collections.","↗"],["Taxi / minibus business","Taxi and minibus businesses","Vehicles, routes, drivers and collections.","▤"],["Trucking / logistics","Trucking and logistics","Fleet, consignments, dispatch and delivery tracking.","⇢"],["Vehicle hire / rental","Vehicle hire and rental","Bookings, fleet availability and rental records.","⌁"],["Vehicle repair garage","Vehicle repair garages","Job cards, parts, technicians and customer updates.","⚙"],["School","Schools","Learners, classes, assessments, fees and attendance.","▦"],["College / training centre","Colleges and training centres","Courses, enrolments, assessments and fees.","▦"],["Clinic / medical centre","Clinics and medical centres","Appointments, service records and operations.","✚"],["Dental practice","Dental practices","Appointments, treatment schedules and patient follow-up.","✚"],["Laboratory","Laboratories","Test requests, sample workflow and results tracking.","⌕"],["Real estate agency","Real estate agencies","Listings, leads, viewings and property transactions.","⌂"],["Landlord / property manager","Landlords and property managers","Tenants, rent tracking, maintenance and leases.","⌂"],["Construction company","Construction companies","Projects, site tasks, materials and contractors.","▧"],["Building contractor","Hardware and building contractors","Contracts, project stages, supplies and crews.","▧"],["Salon / barbershop","Salons and barbershops","Bookings, services, staff and retail products.","✂"],["Fashion / tailoring","Fashion and tailoring businesses","Measurements, orders, materials and delivery dates.","✦"],["Cleaning service","Cleaning services","Bookings, work schedules, teams and job completion.","✧"],["Security company","Security companies","Guard assignments, rosters, incidents and attendance.","◉"],["Consultancy / accounting firm","Consultancy and accounting firms","Clients, engagements, deadlines and deliverables.","＝"],["ICT / software company","ICT and software companies","Projects, releases, support and technical teams.","⌘"],["Printing / stationery business","Printing and stationery businesses","Print jobs, stationery stock, quotes and deliveries.","▤"],["NGO / community organization","NGOs and community organizations","Programs, beneficiaries, activities and grant reporting.","♡"]];
  let catalog = fallbackCatalog;
  let byName = Object.create(null);
  const slugify = value => String(value || '').toLowerCase().normalize('NFKD').replace(/[^\\w\\s-]/g, '').trim().replace(/[\\s_]+/g, '-').replace(/-+/g, '-');
  async function load() {
    const loaded = await Promise.all(fallbackCatalog.map(async fallback => {
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
    catalog = loaded.map(item => {
      const p = item.config;
      return p ? [p.name, p.plural, p.description, p.icon] : item.fallback;
    });
    byName = Object.create(null);
    loaded.forEach(item => {
      const p = item.config;
      byName[item.fallback[0]] = p || {
        name: item.fallback[0], slug: slugify(item.fallback[0]),
        plural: item.fallback[1], description: item.fallback[2], icon: item.fallback[3],
        features: []
      };
    });
    return catalog;
  }
  window.MolanBusinessProfiles = {
    get catalog() { return catalog; },
    get byName() { return byName; },
    load,
    slugify
  };
})();
