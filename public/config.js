// config.js – Warming Us site configuration

const SITE_KEY = 'warming-us-shfx';

const SUPABASE_URL = 'https://xhvimodqpzegibojxlfi.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhodmltb2RxcHplZ2lib2p4bGZpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg5MjQ0NjcsImV4cCI6MjA3NDUwMDQ2N30.veBZSV_lSVOZMQayQza1lhzjmUvfMhN716uRJjPjxgY';

const PAGES = ['index', 'about', 'services', 'contact'];

const SCHEMA = {
  site_key: SITE_KEY,
  business: {
    name: 'Warming Us',
    tagline: 'Plumbers & heating engineers in South Wales',
    email: 'Warningus@outlook.com',
    phone: '07944280164',
    address: 'South Wales',
    founded: '2012',
    insured: true,
    area: 'South Wales — free quotes within Cardiff',
    canonical: 'https://warming-us-shfx.onrender.com/'
  },
  sections: [
    // ── HOME PAGE ──────────────────────────────────────────────
    {
      id: 'hero',
      name: 'Home – Hero',
      page: 'index',
      fields: {
        headline: 'South Wales Plumbing\n& Heating Engineers',
        tagline: 'Boilers, bathrooms, power flushing and 24/7 emergency call outs. Local team, fixed quotes and free Cardiff estimates.',
        cta_text: 'Call 07944 280164',
        image: './images/01_hero_plumber_working-desktop.webp'
      }
    },
    {
      id: 'about',
      name: 'Home – About Teaser',
      page: 'index',
      fields: {
        title: 'South Wales Plumbing & Heating Experts',
        description: 'Warming Us handles boilers, bathrooms, servicing, power flushing and 24/7 call outs across South Wales. 14 years\' experience, registered and free Cardiff quotes.'
      }
    },

    // ── ABOUT PAGE ────────────────────────────────────────────
    {
      id: 'about_page',
      name: 'About – Full Page',
      page: 'about',
      fields: {
        headline: 'Who We Are',
        story: 'Warming Us is a South Wales plumbing and heating team founded in 2012. We fit boilers, install bathrooms, service heating systems and handle urgent breakdowns.',
        mission: 'Warm Homes. Safe Systems. Clear Quotes.',
        values_title: 'Our Values',
        value1_name: 'Reliability',
        value1_desc: 'We arrive when agreed, do what we quoted and keep you updated until the job is finished.',
        value2_name: 'Transparency',
        value2_desc: 'Clear advice, clear pricing and no surprise add-ons. Free quotes are available within Cardiff.',
        value3_name: 'Expertise',
        value3_desc: 'Boilers, bathrooms, gas certificates, servicing and power flushing are handled by experienced engineers.',
        team_title: 'Our Team',
        team_description: 'A local South Wales team, not a call centre. The same engineers quote, explain the work and carry it through to sign-off.',
        image: './images/team-workshop-1200x1200.webp'
      }
    },

    // ── SERVICES PAGE ─────────────────────────────────────────
    {
      id: 'services_page',
      name: 'Services – Full Page',
      page: 'services',
      fields: {
        title: 'Plumbing & Heating Services',
        intro: 'Boiler installation, bathroom suites, gas safety certificates, power flushing and emergency plumbing across South Wales. Free Cardiff quotes.',
        service1_name: 'Plumbing & Heating Installation',
        service1_desc: 'Bathroom suites from £499, boiler installs and full heating upgrades. We assess the job, quote clearly and fit it with minimal disruption.',
        service1_price: 'Bathroom Suites From £499',
        service2_name: 'Service & Certificates',
        service2_desc: 'Boiler servicing, gas safety checks and landlord CP12 certificates. Proper records, tidy work and clear advice if something needs attention.',
        service2_price: 'Free Quote',
        service3_name: 'Maintenance & Power Flush',
        service3_desc: 'Power flushing, sludge removal, radiator balancing and planned maintenance to keep heating efficient and reduce breakdowns.',
        service3_price: 'Free Quote',
        service4_name: '24/7 Emergency Call Out',
        service4_desc: 'Burst pipe, boiler breakdown, no heat or no hot water. Call any time for emergency plumbing and heating support across South Wales.',
        service4_price: 'Call 07944 280164',
        cta_text: 'Need a Quote?',
        cta_description: 'Call 07944 280164 for emergency help, boiler work, servicing or a free Cardiff quote.'
      }
    },

    // ── CONTACT PAGE ──────────────────────────────────────────
    {
      id: 'contact_page',
      name: 'Contact – Full Page',
      page: 'contact',
      fields: {
        headline: 'Contact Warming Us',
        description: 'Need a plumber or heating engineer in South Wales? Call for emergencies, boiler work, servicing or a free Cardiff quote.',
        phone: '07944280164',
        email: 'Warningus@outlook.com',
        address: 'South Wales',
        hours_title: 'Availability',
        hours: 'Available 24/7 — Emergency call outs any time',
        cta_text: 'Call for emergency plumbing, boiler work, servicing or a free quote. We cover South Wales and respond 24/7 when heating or hot water fails.'
      }
    }
  ]
};

// Helper: get section data by id
function getSectionData(sectionId) {
  const section = SCHEMA.sections.find(s => s.id === sectionId);
  return section ? section.fields : null;
}

// Helper: get all sections for a page
function getPageSections(pageName) {
  return SCHEMA.sections.filter(s => s.page === pageName);
}

// Supabase client initialisation (safe — only runs if library loaded)
let supabaseClient = null;
if (typeof supabase !== 'undefined') {
  try {
    supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  } catch (e) {
    console.warn('Supabase init failed:', e);
  }
}

// Populate data-content attributes from SCHEMA
function populateContentFromSchema() {
  const elements = document.querySelectorAll('[data-content]');
  elements.forEach(el => {
    const key = el.getAttribute('data-content');
    if (!key) return;
    const [sectionId, fieldName] = key.split('.');
    const sectionData = getSectionData(sectionId);
    if (sectionData && sectionData[fieldName] !== undefined) {
      const value = sectionData[fieldName];
      if (el.tagName === 'IMG') {
        el.src = value;
      } else if (el.tagName === 'A') {
        el.textContent = value;
      } else {
        // Preserve HTML line breaks for multi-line fields
        el.innerHTML = value.replace(/\n/g, '<br>');
      }
    }
  });
}

// Run on DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', populateContentFromSchema);
} else {
  populateContentFromSchema();
}
