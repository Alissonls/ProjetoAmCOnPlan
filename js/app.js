/**
 * AmCOn Saúde - Aplicação Frontend Principal
 * Gerencia o simulador de planos, filtros da rede credenciada,
 * modais de login/cotação, FAQ interativo e integração com o Chat.
 */

document.addEventListener('DOMContentLoaded', () => {
  initPlanPricingToggle();
  initPlanCategoryTabs();
  initNetworkSearch();
  initInteractiveQuoteSimulator();
  initFaqAccordion();
  initModalHandlers();
  initMobileMenu();
});

/* ==========================================================================
   1. Alternância de Coparticipação & Preços Dinâmicos dos Planos
   ========================================================================== */
const planBasePrices = {
  essencial: { withCopay: 189.00, withoutCopay: 249.00 },
  conforto: { withCopay: 299.90, withoutCopay: 389.90 },
  exclusivo: { withCopay: 680.00, withoutCopay: 890.00 },
  dental: { withCopay: 29.90, withoutCopay: 29.90 }
};

let currentCopay = 'withCopay'; // or 'withoutCopay'

function initPlanPricingToggle() {
  const toggleCheckbox = document.getElementById('copay-toggle');
  if (!toggleCheckbox) return;

  toggleCheckbox.addEventListener('change', (e) => {
    currentCopay = e.target.checked ? 'withoutCopay' : 'withCopay';
    updateDisplayedPlanPrices();
    
    const labelWith = document.getElementById('label-with-copay');
    const labelWithout = document.getElementById('label-without-copay');
    if (labelWith && labelWithout) {
      if (e.target.checked) {
        labelWith.classList.remove('font-bold', 'text-sky-900');
        labelWith.classList.add('text-slate-500');
        labelWithout.classList.add('font-bold', 'text-sky-900');
        labelWithout.classList.remove('text-slate-500');
      } else {
        labelWith.classList.add('font-bold', 'text-sky-900');
        labelWith.classList.remove('text-slate-500');
        labelWithout.classList.remove('font-bold', 'text-sky-900');
        labelWithout.classList.add('text-slate-500');
      }
    }
  });
}

function updateDisplayedPlanPrices() {
  Object.keys(planBasePrices).forEach(planKey => {
    const el = document.getElementById(`price-${planKey}`);
    if (el) {
      const price = planBasePrices[planKey][currentCopay];
      el.innerText = `R$ ${price.toFixed(2).replace('.', ',')}`;
    }
  });
}

/* ==========================================================================
   2. Abas de Categorias de Planos (Individual, PME, Grandes Empresas, Sênior)
   ========================================================================== */
function initPlanCategoryTabs() {
  const tabs = document.querySelectorAll('.plan-category-tab');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => {
        t.classList.remove('active', 'bg-sky-600', 'text-white', 'shadow-md');
        t.classList.add('bg-slate-100', 'text-slate-700', 'hover:bg-slate-200');
      });
      tab.classList.remove('bg-slate-100', 'text-slate-700', 'hover:bg-slate-200');
      tab.classList.add('active', 'bg-sky-600', 'text-white', 'shadow-md');

      const category = tab.getAttribute('data-category');
      applyCategoryDiscount(category);
    });
  });
}

function applyCategoryDiscount(category) {
  // Ajuste visual nos cards de acordo com a categoria selecionada
  const subtitleElements = document.querySelectorAll('.plan-audience-tag');
  subtitleElements.forEach(el => {
    if (category === 'pme') {
      el.innerText = 'Condição especial para CNPJ (a partir de 2 vidas)';
    } else if (category === 'senior') {
      el.innerText = 'Programa de Longevidade Ativa 60+ incluso';
    } else if (category === 'corporate') {
      el.innerText = 'Gestão integrada de saúde corporativa e absenteísmo';
    } else {
      el.innerText = 'Cobertura completa para você e dependentes';
    }
  });
}

/* ==========================================================================
   3. Busca & Filtro Interativo na Rede Credenciada
   ========================================================================== */
const accreditedNetworkData = [
  {
    id: 1,
    name: "Hospital Samaritano & Pronto-Socorro 24h",
    type: "hospital",
    specialties: ["Cardiologia", "Ortopedia", "Pediatria", "Maternidade", "Emergência 24h"],
    city: "São Paulo - SP",
    neighborhood: "Higienópolis",
    address: "Rua Conselheiro Brotero, 1486",
    rating: 4.9,
    plans: ["AmCOn Conforto Plus", "AmCOn Exclusivo Black"],
    badge: "Emergência 24h",
    phone: "(11) 3821-5300"
  },
  {
    id: 2,
    name: "Hospital Alemão Oswaldo Cruz",
    type: "hospital",
    specialties: ["Oncologia", "Cardiologia", "Cirurgia Geral", "Neurologia"],
    city: "São Paulo - SP",
    neighborhood: "Paraíso",
    address: "Rua Treze de Maio, 1815",
    rating: 4.9,
    plans: ["AmCOn Exclusivo Black"],
    badge: "Referência Nacional",
    phone: "(11) 3549-0000"
  },
  {
    id: 3,
    name: "Centro Médico & Diagnóstico AmCOn Saúde",
    type: "clinica",
    specialties: ["Clínica Geral", "Dermatologia", "Ginecologia", "Pediatria", "Nutrição"],
    city: "São Paulo - SP",
    neighborhood: "Bela Vista",
    address: "Av. Paulista, 1500 - 8º andar",
    rating: 4.8,
    plans: ["AmCOn Essencial", "AmCOn Conforto Plus", "AmCOn Exclusivo Black"],
    badge: "Atendimento Rápido",
    phone: "(11) 4002-8922"
  },
  {
    id: 4,
    name: "Laboratório Fleury / Grupo Fleury",
    type: "laboratorio",
    specialties: ["Análises Clínicas", "Ressonância Magnética", "Tomografia", "Ultrassonografia"],
    city: "São Paulo - SP",
    neighborhood: "Jardins",
    address: "Rua Caconde, 234",
    rating: 5.0,
    plans: ["AmCOn Conforto Plus", "AmCOn Exclusivo Black"],
    badge: "Exames de Alta Precisão",
    phone: "(11) 3179-0822"
  },
  {
    id: 5,
    name: "Hospital São Luiz / Rede D'Or",
    type: "hospital",
    specialties: ["Pronto-Socorro Adulto e Infantil", "Ortopedia", "Cirurgia Cardíaca"],
    city: "São Paulo - SP",
    neighborhood: "Itaim Bibi",
    address: "Rua Dr. Alceu de Campos Rodrigues, 95",
    rating: 4.8,
    plans: ["AmCOn Conforto Plus", "AmCOn Exclusivo Black"],
    badge: "Emergência 24h",
    phone: "(11) 3040-1100"
  },
  {
    id: 6,
    name: "Clínica Oftalmológica Visão Plena",
    type: "clinica",
    specialties: ["Oftalmologia", "Cirurgia Refrativa", "Glaucoma", "Exames de Vista"],
    city: "São Paulo - SP",
    neighborhood: "Pinheiros",
    address: "Rua dos Pinheiros, 650",
    rating: 4.7,
    plans: ["AmCOn Essencial", "AmCOn Conforto Plus", "AmCOn Exclusivo Black"],
    badge: "Tecnologia a Laser",
    phone: "(11) 3088-4122"
  }
];

function initNetworkSearch() {
  const searchInput = document.getElementById('network-search-input');
  const typeFilter = document.getElementById('network-type-filter');
  const specialtyFilter = document.getElementById('network-specialty-filter');
  const resultsContainer = document.getElementById('network-results-container');
  const resultsCount = document.getElementById('network-results-count');

  if (!resultsContainer) return;

  function renderNetwork(items) {
    if (resultsCount) {
      resultsCount.innerText = `${items.length} unidades encontradas`;
    }

    if (items.length === 0) {
      resultsContainer.innerHTML = `
        <div class="col-span-full py-12 text-center bg-white rounded-2xl border border-slate-200">
          <div class="text-4xl mb-3">🔍</div>
          <h4 class="text-base font-bold text-slate-800">Nenhum credenciado encontrado com estes filtros</h4>
          <p class="text-xs text-slate-500 mt-1">Tente pesquisar por termos como "Cardiologia", "Higienópolis" ou "Hospital".</p>
          <button id="reset-network-filters-btn" class="mt-4 px-4 py-2 bg-sky-600 text-white rounded-lg text-xs font-semibold hover:bg-sky-700 transition">
            Limpar Filtros de Busca
          </button>
        </div>
      `;
      const resetBtn = document.getElementById('reset-network-filters-btn');
      if (resetBtn) {
        resetBtn.addEventListener('click', () => {
          if (searchInput) searchInput.value = '';
          if (typeFilter) typeFilter.value = 'all';
          if (specialtyFilter) specialtyFilter.value = 'all';
          renderNetwork(accreditedNetworkData);
        });
      }
      return;
    }

    resultsContainer.innerHTML = items.map(item => `
      <div class="bg-white border border-slate-200 hover:border-sky-300 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between group">
        <div>
          <div class="flex items-start justify-between gap-3">
            <span class="text-xs font-bold px-2.5 py-1 rounded-full ${
              item.type === 'hospital' ? 'bg-rose-50 text-rose-700 border border-rose-200' :
              item.type === 'laboratorio' ? 'bg-sky-50 text-sky-700 border border-sky-200' :
              'bg-teal-50 text-teal-700 border border-teal-200'
            }">
              ${item.badge}
            </span>
            <div class="flex items-center text-amber-500 text-xs font-bold">
              ★ <span>${item.rating}</span>
            </div>
          </div>

          <h4 class="text-base font-bold text-slate-900 mt-3 group-hover:text-sky-700 transition">
            ${item.name}
          </h4>

          <p class="text-xs text-slate-500 mt-1 flex items-center gap-1.5">
            <svg class="w-3.5 h-3.5 text-slate-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
            ${item.address} - ${item.neighborhood}, ${item.city}
          </p>

          <div class="mt-3 flex flex-wrap gap-1.5">
            ${item.specialties.map(spec => `
              <span class="text-[11px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-medium">${spec}</span>
            `).join('')}
          </div>
        </div>

        <div class="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between">
          <div class="text-[11px] text-slate-500">
            Tel: <span class="font-semibold text-slate-700">${item.phone}</span>
          </div>
          <button onclick="triggerConsultationBooking('${item.name}')" class="px-3 py-1.5 bg-sky-50 hover:bg-sky-600 hover:text-white text-sky-700 text-xs font-semibold rounded-lg border border-sky-200 hover:border-transparent transition flex items-center gap-1">
            Agendar Consulta
          </button>
        </div>
      </div>
    `).join('');
  }

  function filterNetwork() {
    const query = searchInput ? searchInput.value.toLowerCase().trim() : '';
    const selectedType = typeFilter ? typeFilter.value : 'all';
    const selectedSpecialty = specialtyFilter ? specialtyFilter.value : 'all';

    const filtered = accreditedNetworkData.filter(item => {
      const matchQuery = !query || 
        item.name.toLowerCase().includes(query) || 
        item.neighborhood.toLowerCase().includes(query) || 
        item.specialties.some(s => s.toLowerCase().includes(query));

      const matchType = selectedType === 'all' || item.type === selectedType;
      const matchSpecialty = selectedSpecialty === 'all' || item.specialties.includes(selectedSpecialty);

      return matchQuery && matchType && matchSpecialty;
    });

    renderNetwork(filtered);
  }

  if (searchInput) searchInput.addEventListener('input', filterNetwork);
  if (typeFilter) typeFilter.addEventListener('change', filterNetwork);
  if (specialtyFilter) specialtyFilter.addEventListener('change', filterNetwork);

  // Render inicial
  renderNetwork(accreditedNetworkData);
}

// Abertura de Agendamento direcionando para o Chatbot
window.triggerConsultationBooking = function(unitName) {
  const customEvent = new CustomEvent('openAmCOnChat', {
    detail: {
      flow: 'flow_rede',
      value: `Gostaria de agendar consulta no ${unitName}`
    }
  });
  document.dispatchEvent(customEvent);
};

/* ==========================================================================
   4. Simulador de Cotação Passo a Passo (Wizard Interativo)
   ========================================================================== */
function initInteractiveQuoteSimulator() {
  const wizardForm = document.getElementById('quote-wizard-form');
  const beneficiaryList = document.getElementById('simulator-beneficiary-list');
  const addBeneficiaryBtn = document.getElementById('add-beneficiary-btn');
  const ageSelect = document.getElementById('beneficiary-age-select');
  const resultCard = document.getElementById('simulator-result-box');
  const calculatedTotal = document.getElementById('sim-calculated-total');
  const calculatedPerPerson = document.getElementById('sim-calculated-per-person');

  let beneficiaries = [{ age: '24-28' }]; // Default 1 vida

  function getBasePriceByAge(age) {
    switch (age) {
      case '0-18': return 145.00;
      case '19-23': return 175.00;
      case '24-28': return 210.00;
      case '29-33': return 245.00;
      case '34-38': return 280.00;
      case '39-43': return 340.00;
      case '44-48': return 420.00;
      case '49-53': return 540.00;
      case '54-58': return 690.00;
      case '59+': return 890.00;
      default: return 210.00;
    }
  }

  function renderBeneficiaries() {
    if (!beneficiaryList) return;
    beneficiaryList.innerHTML = beneficiaries.map((b, idx) => `
      <div class="inline-flex items-center gap-1.5 bg-sky-50 border border-sky-200 text-sky-800 text-xs px-3 py-1.5 rounded-full font-medium">
        <span>Beneficiário #${idx + 1}: ${b.age} anos</span>
        ${beneficiaries.length > 1 ? `
          <button type="button" onclick="removeBeneficiary(${idx})" class="text-rose-500 hover:text-rose-700 ml-1 font-bold">
            &times;
          </button>
        ` : ''}
      </div>
    `).join('');

    calculateSimulationTotal();
  }

  window.removeBeneficiary = function(index) {
    beneficiaries.splice(index, 1);
    renderBeneficiaries();
  };

  if (addBeneficiaryBtn && ageSelect) {
    addBeneficiaryBtn.addEventListener('click', () => {
      beneficiaries.push({ age: ageSelect.value });
      renderBeneficiaries();
    });
  }

  function calculateSimulationTotal() {
    const accomodationType = document.querySelector('input[name="sim_accomodation"]:checked')?.value || 'apartamento';
    const accMultiplier = accomodationType === 'apartamento' ? 1.22 : 1.0;

    let subtotal = 0;
    beneficiaries.forEach(b => {
      subtotal += getBasePriceByAge(b.age);
    });

    // Desconto família/grupo progressivo
    let discount = 1.0;
    if (beneficiaries.length === 2) discount = 0.95; // 5% off
    if (beneficiaries.length >= 3) discount = 0.90; // 10% off

    const total = subtotal * accMultiplier * discount;
    const perPerson = total / beneficiaries.length;

    if (calculatedTotal) {
      calculatedTotal.innerText = `R$ ${total.toFixed(2).replace('.', ',')}`;
    }
    if (calculatedPerPerson) {
      calculatedPerPerson.innerText = `Média de R$ ${perPerson.toFixed(2).replace('.', ',')} por vida/mês`;
    }
  }

  // Radios de acomodação
  const simRadios = document.querySelectorAll('input[name="sim_accomodation"]');
  simRadios.forEach(radio => {
    radio.addEventListener('change', calculateSimulationTotal);
  });

  // Gatilho do formulário do Hero para preencher o simulador
  const heroForm = document.getElementById('hero-quick-quote-form');
  if (heroForm) {
    heroForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const simSection = document.getElementById('simulador') || document.getElementById('simulador-section');
      if (simSection) {
        simSection.scrollIntoView({ behavior: 'smooth' });
      }
    });
  }

  renderBeneficiaries();
}

/* ==========================================================================
   5. FAQ Interativo com Acordeão e Busca Instantânea
   ========================================================================== */
function initFaqAccordion() {
  const faqItems = document.querySelectorAll('.faq-item');
  const faqSearch = document.getElementById('faq-search-input');

  faqItems.forEach(item => {
    const questionBtn = item.querySelector('.faq-question-btn');
    const answer = item.querySelector('.faq-answer');
    const icon = item.querySelector('.faq-chevron');

    if (!questionBtn || !answer) return;

    questionBtn.addEventListener('click', () => {
      const isExpanded = !answer.classList.contains('hidden');

      // Fecha outros itens para comportamento de acordeão limpo
      faqItems.forEach(other => {
        const otherAnswer = other.querySelector('.faq-answer');
        const otherIcon = other.querySelector('.faq-chevron');
        if (otherAnswer && other !== item) {
          otherAnswer.classList.add('hidden');
          if (otherIcon) otherIcon.classList.remove('rotate-180');
        }
      });

      if (isExpanded) {
        answer.classList.add('hidden');
        if (icon) icon.classList.remove('rotate-180');
      } else {
        answer.classList.remove('hidden');
        if (icon) icon.classList.add('rotate-180');
      }
    });
  });

  // Busca rápida nas perguntas
  if (faqSearch) {
    faqSearch.addEventListener('input', (e) => {
      const query = e.target.value.toLowerCase().trim();
      faqItems.forEach(item => {
        const text = item.innerText.toLowerCase();
        if (text.includes(query)) {
          item.classList.remove('hidden');
        } else {
          item.classList.add('hidden');
        }
      });
    });
  }
}

/* ==========================================================================
   6. Modais do Sistema (Área do Cliente / Portal Login)
   ========================================================================== */
function initModalHandlers() {
  const loginModal = document.getElementById('client-portal-modal');
  const openLoginBtns = document.querySelectorAll('.open-client-portal-btn');
  const closeLoginBtn = document.getElementById('close-portal-modal-btn');

  function openPortalModal() {
    if (loginModal) {
      loginModal.classList.remove('hidden');
      document.body.classList.add('overflow-hidden');
    }
  }

  function closePortalModal() {
    if (loginModal) {
      loginModal.classList.add('hidden');
      document.body.classList.remove('overflow-hidden');
    }
  }

  openLoginBtns.forEach(btn => btn.addEventListener('click', openPortalModal));
  if (closeLoginBtn) closeLoginBtn.addEventListener('click', closePortalModal);

  if (loginModal) {
    loginModal.addEventListener('click', (e) => {
      if (e.target === loginModal) closePortalModal();
    });
  }

  // Tabs do Portal de Login (Beneficiário, Empresa, Credenciado)
  const portalTabs = document.querySelectorAll('.portal-tab-btn');
  portalTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      portalTabs.forEach(t => {
        t.classList.remove('border-sky-600', 'text-sky-700', 'font-bold');
        t.classList.add('border-transparent', 'text-slate-500');
      });
      tab.classList.add('border-sky-600', 'text-sky-700', 'font-bold');
      tab.classList.remove('border-transparent', 'text-slate-500');
    });
  });
}

/* ==========================================================================
   7. Menu Mobile
   ========================================================================== */
function initMobileMenu() {
  const toggleBtn = document.getElementById('mobile-menu-toggle-btn');
  const mobileMenu = document.getElementById('mobile-menu');

  if (toggleBtn && mobileMenu) {
    toggleBtn.addEventListener('click', () => {
      mobileMenu.classList.toggle('hidden');
    });

    const mobileLinks = mobileMenu.querySelectorAll('a');
    mobileLinks.forEach(link => {
      link.addEventListener('click', () => {
        mobileMenu.classList.add('hidden');
      });
    });
  }
}
