// config.js – Warming Us site configuration

const SITE_KEY = 'warming-us-shfx';

const SUPABASE_URL = 'https://xhvimodqpzegibojxlfi.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhodmltb2RxcHplZ2lib2p4bGZpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg5MjQ0NjcsImV4cCI6MjA3NDUwMDQ2N30.veBZSV_lSVOZMQayQza1lhzjmUvfMhN716uRJjPjxgY';

const PAGES = ['index', 'about', 'services', 'contact'];

const SCHEMA = {
  site_key: SITE_KEY,
  business: {
    name: 'Warming Us',
    tagline: 'Keep you warm all year round',
    email: 'kenellbt1@gmail.com',
    phone: '',
    address: 'Cardiff, Wales, UK',
    founded: '2020',
    insured: true,
    area: 'Cardiff and surrounding areas',
    canonical: 'https://warming-us-shfx.onrender.com/'
  },
  sections: [
    // ── HOME PAGE ──────────────────────────────────────────────
    {
      id: 'hero',
      name: 'Home – Hero',
      page: 'index',
      fields: {
        headline: 'Keep You Warm All Year Round.',
        tagline: 'Heating installation, boiler fitting, boiler repairs & gas plumbing — fully insured, serving Cardiff since 2020.',
        cta_text: 'Book a Call',
        image: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=1600&q=80'
      }
    },
    {
      id: 'about',
      name: 'Home – About Teaser',
      page: 'index',
      fields: {
        title: 'Built on Trust. Driven by Warmth.',
        description: 'Founded in 2020 and proudly based in Cardiff, Warming Us was built on a simple promise — to deliver expert heating and gas services with honesty, reliability and care. We\'re fully insured and committed to keeping every home and business warm throughout every season.'
      }
    },

    // ── ABOUT PAGE ────────────────────────────────────────────
    {
      id: 'about_page',
      name: 'About – Full Page',
      page: 'about',
      fields: {
        headline: 'Who We Are',
        story: 'Warming Us was founded in 2020 by a team of passionate heating engineers who saw a gap in the Cardiff market for honest, high-quality heating services. Starting with a single van and a commitment to excellence, we have grown into one of Cardiff\'s most trusted names in heating and gas plumbing.',
        mission: 'Our mission is simple: to keep every home and business warm, safe and comfortable — year-round. We do this by combining technical expertise with transparent pricing, reliable scheduling and a genuine care for our customers.',
        values_title: 'Our Values',
        value1_name: 'Reliability',
        value1_desc: 'We show up when we say we will, complete jobs to the highest standard, and stand behind every piece of work we do.',
        value2_name: 'Transparency',
        value2_desc: 'No hidden charges, no surprise fees. You\'ll know exactly what you\'re getting before any work begins.',
        value3_name: 'Expertise',
        value3_desc: 'Our engineers are fully trained, Gas Safe registered and continuously updated on the latest heating technologies.',
        team_title: 'Our Team',
        team_description: 'Our small but highly skilled team brings decades of combined experience in domestic and commercial heating. Every engineer is fully insured, Gas Safe registered, and dedicated to delivering work that lasts.',
        image: 'https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=800&q=80'
      }
    },

    // ── SERVICES PAGE ─────────────────────────────────────────
    {
      id: 'services_page',
      name: 'Services – Full Page',
      page: 'services',
      fields: {
        title: 'Our Services',
        intro: 'From new installations to emergency repairs — we provide a complete range of heating and gas plumbing services for homes and businesses across Cardiff.',
        service1_name: 'Heating Installation',
        service1_desc: 'Full design and installation of central heating systems tailored to your property. We assess your space, recommend the most efficient solution, and carry out a clean, professional installation with minimal disruption.',
        service1_price: 'From £1,200',
        service2_name: 'Boiler Fitting',
        service2_desc: 'New boiler supply and installation from leading brands including Worcester Bosch, Viessmann and Baxi. We handle everything from removal of your old unit to commissioning the new system.',
        service2_price: 'From £800',
        service3_name: 'Boiler Repairs',
        service3_desc: 'Fast diagnosis and repair of boiler faults. Our engineers carry a comprehensive range of spare parts, meaning most boilers are fixed on the first visit. No fix, no call-out fee.',
        service3_price: 'From £85',
        service4_name: 'Gas Plumbing',
        service4_desc: 'Safe, compliant gas pipework, connections and pressure testing. Whether you\'re extending your gas supply, fitting a new cooker or carrying out a full gas system overhaul — we do it right.',
        service4_price: 'From £120',
        cta_text: 'Book a Call',
        cta_description: 'Not sure which service you need? Get in touch and we\'ll talk you through the options with no obligation.'
      }
    },

    // ── CONTACT PAGE ──────────────────────────────────────────
    {
      id: 'contact_page',
      name: 'Contact – Full Page',
      page: 'contact',
      fields: {
        headline: 'Get In Touch',
        description: 'Ready to book a service, get a quote, or just have a question? We\'re here to help. Reach out and one of our team will get back to you promptly.',
        phone: '',
        email: 'kenellbt1@gmail.com',
        address: 'Cardiff, Wales, UK',
        hours_title: 'Opening Hours',
        hours: 'Monday – Friday: 8:00am – 6:00pm\nSaturday: 9:00am – 4:00pm\nSunday: Emergency call-outs only',
        cta_text: 'Send a Message'
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