// config.js – Warming Us site configuration

const SITE_KEY = 'warming-us-shfx';

const SUPABASE_URL = 'https://xhvimodqpzegibojxlfi.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhodmltb2RxcHplZ2lib2p4bGZpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg5MjQ0NjcsImV4cCI6MjA3NDUwMDQ2N30.veBZSV_lSVOZMQayQza1lhzjmUvfMhN716uRJjPjxgY';

const PAGES = ['index', 'about', 'services', 'contact'];

const SCHEMA = {
  site_key: SITE_KEY,
  business: {
    name: 'Warming Us',
    tagline: 'South Wales plumbing & heating specialists',
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
        headline: 'Plumbing & Heating You Can Rely On.',
        tagline: 'Installation, servicing, maintenance & 24/7 emergency call outs across South Wales. 14 years\' experience. Free quotes within Cardiff.',
        cta_text: 'Call Now',
        image: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=1600&q=80'
      }
    },
    {
      id: 'about',
      name: 'Home – About Teaser',
      page: 'index',
      fields: {
        title: 'South Wales Plumbing & Heating Experts',
        description: 'With 14 years\' experience serving South Wales, Warming Us delivers expert plumbing and heating services you can trust. From bathroom suites (from just £499) and boiler installation to power flush services and 24/7 emergency call outs — we do it all. Registered at Companies House (No. 15664544) and proud to offer free quotes within Cardiff.'
      }
    },

    // ── ABOUT PAGE ────────────────────────────────────────────
    {
      id: 'about_page',
      name: 'About – Full Page',
      page: 'about',
      fields: {
        headline: 'Who We Are',
        story: 'Warming Us was founded in 2012 and has been proudly serving South Wales for 14 years. What started as a passion for getting the job done right has grown into one of the region\'s most trusted plumbing and heating companies. We specialise in installation, service & certificates, maintenance, power flush services, boiler installation, and bathroom suites from as little as £499. Registered at Companies House (No. 15664544), we offer 24/7 emergency call outs across South Wales with free quotes within Cardiff.',
        mission: 'Our mission is simple: to keep every home and business in South Wales warm, safe and comfortable — year-round. We do this by combining 14 years of technical expertise with transparent pricing, reliable scheduling and a genuine care for our customers. From boiler installations to power flush services, we\'re here 24/7.',
        values_title: 'Our Values',
        value1_name: 'Reliability',
        value1_desc: 'We show up when we say we will, complete jobs to the highest standard, and stand behind every piece of work we do. 14 years of trusted service across South Wales.',
        value2_name: 'Transparency',
        value2_desc: 'No hidden charges, no surprise fees. You\'ll know exactly what you\'re getting before any work begins. Free quotes within Cardiff.',
        value3_name: 'Expertise',
        value3_desc: 'Our engineers bring 14 years of hands-on experience. From boiler installation and bathroom suites to power flush services — we handle it all professionally.',
        team_title: 'Our Team',
        team_description: 'Our skilled team brings 14 years of combined experience in plumbing and heating across South Wales. We\'re Companies House registered (No. 15664544), available 24/7 for emergencies, and dedicated to delivering work that lasts.',
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
        intro: 'From plumbing & heating installation to 24/7 emergency call outs — we provide a complete range of plumbing and heating services across South Wales. Free quotes within Cardiff.',
        service1_name: 'Plumbing & Heating Installation',
        service1_desc: 'Full plumbing and heating installation including bathroom suites from as little as £499 and boiler installation. We assess your property, recommend the best solution, and carry out a clean, professional installation with minimal disruption across South Wales.',
        service1_price: 'Bathroom Suites From £499',
        service2_name: 'Service & Certificates',
        service2_desc: 'Gas safety certificates, landlord certificates, and boiler servicing to keep your systems compliant and running safely. All work carried out to the highest standards with proper certification for your records.',
        service2_price: 'Free Quote',
        service3_name: 'Maintenance & Power Flush',
        service3_desc: 'Ongoing plumbing and heating maintenance to keep everything running smoothly. Our power flush service cleans and restores your heating system for improved efficiency and longer life. Serving all of South Wales.',
        service3_price: 'Free Quote',
        service4_name: '24/7 Emergency Call Out',
        service4_desc: 'Round-the-clock emergency plumbing and heating call outs across South Wales. When you have an urgent issue — burst pipe, boiler breakdown, or heating failure — call us any time, day or night. 14 years of trusted emergency response.',
        service4_price: 'Call 07944 280164',
        cta_text: 'Call Now',
        cta_description: 'Not sure which service you need? Give us a call on 07944 280164 or get in touch for a free quote within Cardiff.'
      }
    },

    // ── CONTACT PAGE ──────────────────────────────────────────
    {
      id: 'contact_page',
      name: 'Contact – Full Page',
      page: 'contact',
      fields: {
        headline: 'Get In Touch',
        description: 'Ready to book a service, get a quote, or just have a question? We\'re here to help — 24/7 for emergencies. Serving all of South Wales with free quotes within Cardiff.',
        phone: '07944280164',
        email: 'Warningus@outlook.com',
        address: 'South Wales',
        hours_title: 'Availability',
        hours: 'Available 24/7 — Emergency call outs any time',
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