document.addEventListener("DOMContentLoaded", function () {

  const menuToggle = document.getElementById("menuToggle");
  const navLinks = document.getElementById("navLinks");
  const header = document.querySelector("header");
  let lockedSection = null;
  let lockedBounds = null;
  let touchStartY = 0;
  let lastTouchTime = 0;
  let touchVelocity = 0;
  let isClampingScroll = false;
  let clampFrame = null;
  let scrollDelta = 0;
  let scrollFrame = null;
  let momentumFrame = null;
  const prefersReducedMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const hasCoarsePointer = window.matchMedia && window.matchMedia("(pointer: coarse)").matches;
  const isTouchLikeDevice = hasCoarsePointer || navigator.maxTouchPoints > 0;
  const useLockedScrolling = !isTouchLikeDevice && !prefersReducedMotion;

  function getHeaderOffset() {
    return header ? header.offsetHeight : 0;
  }

  function getSectionBounds(section) {
    const headerOffset = getHeaderOffset();
    const sectionTop = section.getBoundingClientRect().top + window.scrollY - headerOffset;
    const sectionBottom = sectionTop + section.offsetHeight;
    const maxScroll = Math.max(sectionTop, sectionBottom - window.innerHeight);

    return {
      top: Math.max(0, sectionTop),
      bottom: Math.max(0, maxScroll)
    };
  }

  function refreshLockedBounds() {
    if (!lockedSection) return null;

    lockedBounds = getSectionBounds(lockedSection);
    return lockedBounds;
  }

  function clampScrollToLockedSection() {
    if (!lockedSection || isClampingScroll) return;

    const bounds = lockedBounds || refreshLockedBounds();
    if (!bounds) return;

    const nextY = Math.min(Math.max(window.scrollY, bounds.top), bounds.bottom);

    if (Math.abs(nextY - window.scrollY) > 1) {
      isClampingScroll = true;
      window.scrollTo(0, nextY);
      requestAnimationFrame(() => {
        isClampingScroll = false;
      });
    }
  }

  function scrollWithinLockedSection(deltaY) {
    if (!lockedSection) return 0;

    const bounds = lockedBounds || refreshLockedBounds();
    if (!bounds) return 0;

    const currentY = window.scrollY;
    const nextY = Math.min(Math.max(window.scrollY + deltaY, bounds.top), bounds.bottom);
    window.scrollTo(0, nextY);
    return nextY - currentY;
  }

  const sectionResizeObserver = typeof ResizeObserver !== "undefined"
    ? new ResizeObserver(() => {
        refreshLockedBounds();
        requestScrollClamp();
      })
    : null;

  function lockToSection(section) {
    lockedSection = section;
    const bounds = refreshLockedBounds();

    if (sectionResizeObserver) {
      sectionResizeObserver.disconnect();
      sectionResizeObserver.observe(section);
    }

    if (!bounds) return;

    window.scrollTo(0, bounds.top);
  }

  function scrollToSection(section, smooth = true) {
    if (useLockedScrolling) {
      lockToSection(section);
      return;
    }

    const headerOffset = getHeaderOffset();
    const sectionTop = section.getBoundingClientRect().top + window.scrollY - headerOffset;
    window.scrollTo({ top: Math.max(0, sectionTop), behavior: smooth ? "smooth" : "auto" });
  }

  function requestLockedScroll(deltaY) {
    scrollDelta += deltaY;

    if (scrollFrame) return;

    scrollFrame = requestAnimationFrame(() => {
      const nextDelta = scrollDelta;
      scrollDelta = 0;
      scrollFrame = null;
      scrollWithinLockedSection(nextDelta);
    });
  }

  function stopScrollMomentum() {
    if (!momentumFrame) return;

    cancelAnimationFrame(momentumFrame);
    momentumFrame = null;
  }

  function startScrollMomentum(initialVelocity) {
    stopScrollMomentum();

    let velocity = initialVelocity;
    let previousTime = performance.now();
    const minimumVelocity = 0.03;
    const friction = 0.94;

    function glide(currentTime) {
      const elapsed = Math.min(currentTime - previousTime, 32);
      previousTime = currentTime;

      const moved = scrollWithinLockedSection(velocity * elapsed);
      velocity *= Math.pow(friction, elapsed / 16);

      if (Math.abs(velocity) < minimumVelocity || Math.abs(moved) < 0.5) {
        momentumFrame = null;
        return;
      }

      momentumFrame = requestAnimationFrame(glide);
    }

    momentumFrame = requestAnimationFrame(glide);
  }

  function requestScrollClamp() {
    if (!lockedSection || clampFrame) return;

    clampFrame = requestAnimationFrame(() => {
      clampFrame = null;
      clampScrollToLockedSection();
    });
  }

  function lockInitialSection() {
    const hashSection = window.location.hash ? document.querySelector(window.location.hash) : null;
    const defaultSection = document.getElementById("home");
    const initialSection = hashSection || defaultSection;

    if (initialSection) {
      lockToSection(initialSection);
    }
  }

  function isModalOpen() {
    return document.getElementById("modalOverlay")?.classList.contains("active");
  }

  function getKeyScrollDistance(key) {
    const lineStep = 80;
    const pageStep = Math.max(120, window.innerHeight - getHeaderOffset() - 40);

    switch (key) {
      case "ArrowDown":
        return lineStep;
      case "ArrowUp":
        return -lineStep;
      case "PageDown":
      case " ":
        return pageStep;
      case "PageUp":
        return -pageStep;
      case "Home":
        return Number.NEGATIVE_INFINITY;
      case "End":
        return Number.POSITIVE_INFINITY;
      default:
        return null;
    }
  }

  if (menuToggle && navLinks) {
    menuToggle.addEventListener("click", function (e) {
      e.stopPropagation();
      navLinks.classList.toggle("show");
    });

    navLinks.querySelectorAll("a").forEach((link) => {
      link.addEventListener("click", function (e) {
        navLinks.classList.remove("show");

        const targetId = link.getAttribute("href");
        if (!targetId || !targetId.startsWith("#")) return;

        const targetSection = document.querySelector(targetId);
        if (!targetSection) return;

        e.preventDefault();
        scrollToSection(targetSection);
      });
    });
  }

  document.querySelector(".logo a")?.addEventListener("click", function (e) {
    const targetId = this.getAttribute("href");
    const targetSection = targetId ? document.querySelector(targetId) : null;

    if (!targetSection) return;

    e.preventDefault();
    scrollToSection(targetSection);
  });

  document.addEventListener("click", function (e) {
    if (e.defaultPrevented) return;

    const link = e.target.closest('a[href^="#"]');
    if (!link) return;

    const targetId = link.getAttribute("href");
    const targetSection = targetId && targetId.length > 1 ? document.querySelector(targetId) : null;
    if (!targetSection) return;

    e.preventDefault();
    scrollToSection(targetSection);
  });

  document.addEventListener("wheel", function (e) {
    if (!lockedSection || isModalOpen()) return;

    stopScrollMomentum();
    e.preventDefault();
    requestLockedScroll(e.deltaY);
  }, { passive: false });

  document.addEventListener("touchstart", function (e) {
    stopScrollMomentum();
    touchStartY = e.touches[0]?.clientY || 0;
    lastTouchTime = performance.now();
    touchVelocity = 0;
  }, { passive: true });

  document.addEventListener("touchmove", function (e) {
    if (!lockedSection || isModalOpen()) return;

    const currentY = e.touches[0]?.clientY || touchStartY;
    const currentTime = performance.now();
    const deltaY = touchStartY - currentY;
    const elapsed = Math.max(currentTime - lastTouchTime, 1);

    touchStartY = currentY;
    lastTouchTime = currentTime;
    touchVelocity = deltaY / elapsed;

    e.preventDefault();
    requestLockedScroll(deltaY);
  }, { passive: false });

  document.addEventListener("touchend", function () {
    if (!lockedSection || isModalOpen()) return;

    if (Math.abs(touchVelocity) > 0.45) {
      startScrollMomentum(touchVelocity);
    }

    touchVelocity = 0;
  }, { passive: true });

  document.addEventListener("keydown", function (e) {
    if (!lockedSection || isModalOpen() || e.ctrlKey || e.metaKey || e.altKey) return;

    const scrollDistance = getKeyScrollDistance(e.key);
    if (scrollDistance === null) return;

    e.preventDefault();

    if (scrollDistance === Number.NEGATIVE_INFINITY) {
      const bounds = lockedBounds || refreshLockedBounds();
      if (bounds) {
        window.scrollTo(0, bounds.top);
      }
      return;
    }

    if (scrollDistance === Number.POSITIVE_INFINITY) {
      const bounds = lockedBounds || refreshLockedBounds();
      if (bounds) {
        window.scrollTo(0, bounds.bottom);
      }
      return;
    }

    scrollWithinLockedSection(scrollDistance);
  });

  window.addEventListener("scroll", function () {
    requestScrollClamp();
  });

  window.addEventListener("resize", function () {
    refreshLockedBounds();
    requestScrollClamp();
  });

  window.addEventListener("load", function () {
    refreshLockedBounds();
    requestScrollClamp();
  });

  if (useLockedScrolling) {
    lockInitialSection();
  } else if (window.location.hash) {
    const hashSection = document.querySelector(window.location.hash);
    if (hashSection) {
      scrollToSection(hashSection, false);
    }
  }

  const heroSection = document.querySelector(".hero");
  const heroText = document.getElementById("heroText");

  const images = ["src/images/img1.webp", "src/images/img2.webp", "src/images/img5.webp"];
  const texts = [
    `<h1>Is your organization prepared to unlock the next level of growth?</h1>`,
    `<h1>Accelerating Business Growth with Artificial Intelligence</h1>`,
    `<h1>Empower Your Organization and accelerate business growth with AI-Driven OKRs</h1>`
  ];

  function preloadImage(src) {
    const img = new Image();
    img.src = src;
  }

  function preloadRemainingHeroImages() {
    images.slice(1).forEach(preloadImage);
  }

  let currentImage = 0;

  function setHeroContent(index) {
    if (!heroSection || !heroText) return;

    heroSection.style.backgroundImage = `url('${images[index]}')`;
    heroText.innerHTML = texts[index];
  }

  function changeHeroContent() {
    if (!heroText) return;

    heroText.classList.remove("fade-in");
    heroText.classList.add("fade-out");

    setTimeout(() => {
      currentImage = (currentImage + 1) % images.length;
      setHeroContent(currentImage);

      heroText.classList.remove("fade-out");
      heroText.classList.add("fade-in");
    }, 250);
  }

  let heroIntervalId = null;

  function startHeroRotation() {
    if (heroIntervalId !== null) return;
    heroIntervalId = setInterval(changeHeroContent, 5000);
  }

  function stopHeroRotation() {
    if (heroIntervalId === null) return;
    clearInterval(heroIntervalId);
    heroIntervalId = null;
  }

  let heroRotationEnabled = false;

  function enableHeroRotation() {
    if (heroRotationEnabled) return;

    heroRotationEnabled = true;
    if (document.visibilityState === "visible") {
      startHeroRotation();
    }
  }

  function registerHeroRotationTrigger() {
    const trigger = () => {
      enableHeroRotation();
      window.removeEventListener("pointerdown", trigger, true);
      window.removeEventListener("keydown", trigger, true);
      window.removeEventListener("touchstart", trigger, true);
      window.removeEventListener("wheel", trigger, true);
    };

    window.addEventListener("pointerdown", trigger, { once: true, capture: true, passive: true });
    window.addEventListener("keydown", trigger, { once: true, capture: true });
    window.addEventListener("touchstart", trigger, { once: true, capture: true, passive: true });
    window.addEventListener("wheel", trigger, { once: true, capture: true, passive: true });
  }

  // Hero rotation disabled: the static hero (headline, tagline, CTAs) in index.html
  // is the intended fixed message and should not be overwritten or cycled.

  window.addEventListener("load", function () {
    if ("requestIdleCallback" in window) {
      window.requestIdleCallback(preloadRemainingHeroImages, { timeout: 2000 });
      return;
    }

    setTimeout(preloadRemainingHeroImages, 1200);
  });

  const chatLauncher = document.getElementById("chat-launcher");
  const chatBox = document.getElementById("chatBox");
  const chatClose = document.getElementById("chatClose");

  if (chatLauncher && chatBox && chatClose) {
    chatLauncher.addEventListener("click", () => {
      chatBox.style.display = "flex";
    });

    chatClose.addEventListener("click", () => {
      chatBox.style.display = "none";
    });

    document.getElementById("chatForm")?.addEventListener("submit", function (e) {
      e.preventDefault();
      const name = document.getElementById("name").value;
      const email = document.getElementById("email").value;
      const mobile = document.getElementById("mobile").value;
      const message = document.getElementById("message").value;

      const mailtoLink = `mailto:info@gridsevenai.com?subject=New Inquiry from ${name}&body=${encodeURIComponent(
        `Name: ${name}\nEmail: ${email}\nMobile: ${mobile}\n\n${message}`
      )}`;

      window.location.href = mailtoLink;

      chatBox.style.display = "none";
    });
  }

  document.getElementById("inquiryForm")?.addEventListener("submit", function (e) {
    e.preventDefault();
    const name = document.getElementById("inquiryName").value;
    const email = document.getElementById("inquiryEmail").value;
    const org = document.getElementById("inquiryOrg").value;
    const phone = document.getElementById("inquiryPhone").value;
    const message = document.getElementById("inquiryMessage").value;

    const mailtoLink = `mailto:info@gridsevenai.com?subject=New Inquiry from ${name}&body=${encodeURIComponent(
      `Name: ${name}\nEmail: ${email}\nOrganization: ${org}\nPhone: ${phone}\n\n${message}`
    )}`;

    window.location.href = mailtoLink;
  });
});



const modalData = {

  'okr-strategy': {
    img: 'src/extra_img/AIPoweredOKRManagement.webp',
    bgColor: '#dbeafe',
    fallback: '📊',
    title: 'AI Powered OKR Management',
    summary: '<strong>Align every team around measurable outcomes.</strong> Use AI-guided OKRs to turn strategy into focus, accountability, and faster execution.',
    body: `
      <h3>Are teams busy but not productive? Are goals getting lost between departments?</h3>
      <p><strong>Turn your strategy into measurable goals — Now!</strong></p>
      <p>Our AI-powered OKR framework helps organizations translate strategy into clear, measurable objectives and
      track progress with precision. It can be effectively applied across industries such as <strong>BFSI,
      manufacturing, healthcare, education, finance</strong>, and others.</p>

      <h4>Value Highlights</h4>
      <ul>
        <li><strong>Proven Framework for Strategic Execution:</strong> OKRs are trusted by leading companies to keep teams aligned and focused on high-impact outcomes.</li>
        <li><strong>From Confusion to Clarity:</strong> OKRs simplify complex objectives into measurable outcomes across departments.</li>
        <li><strong>AI-Enabled Insights:</strong> AI-powered analytics surface progress signals, identify bottlenecks, and recommend actions to optimize performance in real time.</li>
      </ul>

      <h4>What We Specialize In</h4>
      <ul>
        <li>OKR Strategy Design &amp; Planning</li>
        <li>OKR Coaching for Leadership &amp; Teams</li>
        <li>OKR Implementation Workshops</li>
        <li>AI-Driven Performance Dashboards</li>
        <li>OKR Reviews &amp; Continuous Improvement</li>
      </ul>

    `
  },

  'okr-coaching': {
    img: 'src/extra_img/BuildingLeadersForTomorrow.webp',
    bgColor: '#dcfce7',
    fallback: '🎓',
    title: 'Building Leaders For Tomorrow\'s Challenges',
    summary: '<strong>Build leadership confidence for the AI era.</strong> Equip decision-makers to identify opportunities, manage risk, and lead transformation with clarity.',
    body: `
      <p>In today's digital economy, <strong>AI is no longer a futuristic concept — it's a strategic imperative.</strong>
      Yet many business leaders still struggle to translate AI's potential into measurable outcomes for their organizations.</p>

      <p>This exclusive <strong>Strategic AI Training</strong> is designed to empower senior leaders, CXOs, and
      decision-makers with the clarity, confidence, and strategic insight needed to lead AI-driven transformation.</p>

      <p>This training program is led by an <strong>IT Leader certified by ISB</strong> in the "Leadership With AI"
      program (Sep 2024 to March 2025). With <strong>25+ years of experience</strong> shaping global technology
      strategies in India and the USA.</p>

      <h4>Topics Covered</h4>
      <ul>
        <li>Introduction to AI for Decision Makers</li>
        <li>AI Fundamentals</li>
        <li>AI Adoption, Strategies, Policy and Risk Management</li>
        <li>Strategic AI Landscape</li>
        <li>Identifying AI Opportunities in your Business</li>
        <li>Future of Work and Leadership in the age of AI</li>
      </ul>

      <h4>Key Takeaways</h4>
      <ul>
        <li>Understand what AI really is — and what it is not</li>
        <li>Identify high-impact AI opportunities across your business</li>
        <li>Navigate AI ethics, governance, and risk with confidence</li>
        <li>Gain real-world insights through case studies and various assignments</li>
      </ul>

      <h4>Who Should Attend</h4>
      <ul>
        <li>CEOs, CTOs, CIOs, COOs, Business Heads &amp; Digital Transformation Leaders</li>
        <li>Senior Managers driving innovation, operations, or technology</li>
        <li>Strategy consultants &amp; enterprise architects</li>
      </ul>
    `
  },

  'okr-implementation': {
    img: 'src/extra_img/BusinessGrowthwithAI.webp',
    bgColor: '#d1fae5',
    fallback: '📈',
    title: 'Strategic Business Growth with AI',
    summary: '<strong>Move from AI interest to business impact.</strong> Apply AI, GenAI, and ML to improve efficiency, intelligence, and profitable growth.',
    body: `
      <p><strong>Artificial Intelligence (AI), Generative AI (GenAI), and Machine Learning (ML)</strong> are
      transforming the way modern businesses operate. At Grid Seven AI, we harness these cutting-edge technologies
      to help organizations unlock new levels of efficiency, intelligence, and profitability.</p>

      <h4>Our AI Capabilities</h4>
      <p>We leverage the full spectrum of AI technologies — from core automation to advanced GenAI systems — to help
      organizations modernize operations, elevate customer experiences, and drive profitable growth.</p>

      <h4>Machine Learning (ML)</h4>
      <p>As a key AI subset, ML uncovers patterns in data to drive predictive analytics and operational optimization.</p>

      <h4>Deep Learning (DL)</h4>
      <p>A sophisticated branch of ML, DL powers complex data processing to deliver deeper insights and enable smarter automation.</p>

      <h4>Generative AI (GenAI)</h4>
      <p>Generative AI is a game-changer for businesses. From crafting personalized customer journeys to enhancing
      employee productivity, it significantly transforms operations.</p>
      <p>Our GenAI solutions are designed to work seamlessly across industries and departments. We drive innovation
      responsibly — prioritizing <strong>data privacy, fairness, and factual accuracy</strong>.</p>
    `
  },

  'ai-dashboards': {
    img: 'src/extra_img/SoftwareTestingwithAI.webp',
    bgColor: '#fef9c3',
    fallback: '🧪',
    title: 'Next Gen Software Testing with AI',
    summary: '<strong>Release software with more confidence.</strong> Combine disciplined QA with AI-driven testing to reduce risk, speed up cycles, and improve quality.',
    body: `
      <p>Effective custom software development requires a strong focus on quality assurance to mitigate risk. This includes
      comprehensive strategies for functional and performance testing, accessibility compliance, and robust security validation.</p>

      <h4>Why Choose Us</h4>
      <ul>
        <li>Cost efficiency</li>
        <li>Best-in-class methodologies and proven AI-driven testing frameworks</li>
        <li>Efficiency gains via intelligent test automation and skilled testing teams</li>
        <li>Reduced dependency on business users, freeing them for strategic initiatives</li>
      </ul>

      <h4>Our Approach</h4>
      <p>We start early — engaging with your teams from the Requirement Definition phase and owning the
      Requirement Traceability Matrix (RTM).</p>
      <ul>
        <li>We interpret business requirement documents to design end-to-end, black-box test scenarios that mirror
        real-world usage and uncover critical defects.</li>
        <li>Designing reliable test scenarios, conditions, test cases, and automated scripts to ensure complete
        functional coverage.</li>
      </ul>
      <p>With well-defined test entry and exit criteria, and a disciplined test execution process, we ensure Test
      Cycles are completed on time and with precision — giving you confidence in every release.</p>
    `
  },

  'caas': {
    img: 'src/extra_img/CapacityAugmentation.webp',
    bgColor: '#fce7f3',
    fallback: '🔧',
    title: 'Capacity Augmentation As a Service (CAAS)',
    summary: '<strong>Scale skills exactly when you need them.</strong> Add experienced technology, AI, QA, and business resources without slowing delivery.',
    body: `
      <p>Our Capacity Augmentation Service helps organizations quickly scale their workforce, skills, and operational
      capability by providing on-demand, skilled resources across technology, AI, product, QA, and business functions.</p>

      <h4>What We Offer</h4>
      <ul>
        <li>On-demand skilled professionals across technology, AI, QA, and business operations</li>
        <li>Project-based or full-time resource deployment</li>
        <li>AI-assisted workforce productivity tools</li>
        <li>Flexible staffing models (short-term, long-term, contract, hybrid or contract-to-hire)</li>
        <li>Specialized experts for niche skills</li>
        <li>Support for peak workloads &amp; seasonal ramp-ups</li>
        <li>Rapid onboarding with zero administrative overhead</li>
        <li>Seamless integration with client teams and workflows</li>
      </ul>

      <h4>Skilled Resources We Provide</h4>
      <ul>
        <li><strong>AI/ML Engineers:</strong> Python, TensorFlow, PyTorch, GitHub, Jenkins, MySQL, Hugging Face Transformers, NLTK, SpaCy</li>
        <li><strong>Data Analysts &amp; Data Engineers:</strong> Snowflake, Databricks, ETL Tools (Talend, Informatica, AWS Glue)</li>
        <li><strong>Software Developers (Full Stack / Backend / Front End):</strong> HTML5, JavaScript, React, Bootstrap, Node.js, Python, Java, C#, MySQL, MongoDB</li>
        <li><strong>QA Engineers &amp; Test Automation Analysts:</strong> Manual &amp; automated testing, API &amp; load testing, JIRA, Azure DevOps, TestRail, GitHub, Jenkins</li>
        <li><strong>PMO Support Experts:</strong> Project governance, risk &amp; change control, resource allocation, portfolio monitoring, Power BI/Tableau, JIRA, MS Project</li>
        <li><strong>Delivery Excellence Directors:</strong> 20+ years experience supporting team productivity, AI-powered OKR reviews, internal audits</li>
      </ul>
    `
  },

  'future-leaders': {
    img: 'src/extra_img/ProgramsForUniversities.webp',
    bgColor: '#ede9fe',
    fallback: '🏫',
    title: 'Future Leaders Programs For Universities',
    summary: '<strong>Connect classrooms with real industry practice.</strong> Help students build problem-solving, AI fluency, and workplace readiness through applied programs.',
    body: `
      <h4>Industry Alignment and Skill Development (IASD) Program</h4>

      <h4>1. Specialized Programs for Universities</h4>
      <p>Design and conduct programs to encourage innovation, problem-solving, and practical application of emerging technologies among students.</p>
      <ul>
        <li><strong>End-to-End Solution Sprint (SS) Design &amp; Execution</strong> — Organizing programs for academic institutions to foster innovation, teamwork, and real-world problem-solving.</li>
        <li><strong>AI-Driven Solution Sprint for Students</strong> — Enabling students to apply AI tools and frameworks to develop practical, industry-relevant solutions.</li>
        <li><strong>Innovation Challenge &amp; Problem-Solving Workshops</strong> — Enabling students to solve real-world business challenges while building practical and collaborative skills.</li>
      </ul>

      <h4>2. Workshops and Live Sessions with Industry Leaders</h4>
      <p>Interactive sessions led by experienced professionals offering students direct exposure to real-world challenges, emerging trends, and practical insights.</p>

      <h4>3. Campus to Corporate Journey</h4>
      <p>A structured transition program designed to prepare students for the professional world by providing insights into workplace expectations, corporate culture, and real-world challenges.</p>

      <h4>4. Assessment Tests &amp; Improvement Plan</h4>
      <p>A structured evaluation framework to assess students' current skill levels, followed by personalized improvement plans aimed at enhancing their competencies and guiding them toward industry readiness.</p>

      <h4>5. Industry Awareness</h4>
      <p>Enabling students to stay informed about current industry trends, emerging technologies, and evolving business practices through curated content and expert sessions.</p>
    `
  },

  'ml-career': {
    img: 'src/images/img1.webp',
    bgColor: '#dbeafe',
    fallback: 'AI',
    title: 'Machine Learning Programmer',
    summary: '<strong>Build production-ready ML solutions.</strong> Work on models, data pipelines, evaluation, and deployment for real business use cases.',
    body: `
      <p><strong>Remote | 2-6 yrs Exp | Full-Time / Consulting Basis</strong></p>
      <h4>Job Summary</h4>
      <p>We are seeking a highly skilled and motivated Machine Learning Programmer to join our team. The ideal candidate will be responsible for developing, training, and deploying machine learning models to solve real-world business problems.</p>

      <h4>Key Responsibilities</h4>
      <ul>
        <li>Design and implement machine learning models and algorithms for classification, regression, clustering, and recommendation tasks.</li>
        <li>Preprocess, clean, and structure data from various sources to ensure model quality.</li>
        <li>Train, fine-tune, and evaluate ML models using frameworks like scikit-learn, TensorFlow, PyTorch, or XGBoost.</li>
        <li>Collaborate with software engineers to integrate models into production systems.</li>
        <li>Perform model testing, validation, and A/B experiments to assess performance.</li>
        <li>Optimize models for speed, accuracy, and scalability.</li>
        <li>Document ML pipelines, processes, and results.</li>
        <li>Stay updated with the latest advancements in AI and machine learning research.</li>
      </ul>

      <h4>Required Skills &amp; Qualifications</h4>
      <ul>
        <li>Bachelor's or Master's degree in Computer Science, Data Science, Mathematics, or related field.</li>
        <li>Strong programming skills in Python (R or Java is a plus).</li>
        <li>Experience with ML libraries and tools like TensorFlow, PyTorch, Keras, scikit-learn, and related frameworks.</li>
        <li>Solid understanding of statistics, data structures, and algorithms.</li>
        <li>Familiarity with version control (e.g., Git) and Agile development.</li>
        <li>Experience with data processing libraries like Pandas, NumPy, and SQL.</li>
        <li>Knowledge of REST APIs and cloud services (AWS/GCP/Azure) is a plus.</li>
      </ul>

      <h4>Preferred Qualifications</h4>
      <ul>
        <li>Experience in Natural Language Processing (NLP), Computer Vision, or Reinforcement Learning.</li>
        <li>Exposure to MLOps tools such as Docker, Kubernetes, and MLflow.</li>
        <li>Familiarity with data engineering workflows using tools like Airflow or Apache Spark.</li>
      </ul>
    `
  },

  'okr-career': {
    img: 'src/images/img2.webp',
    bgColor: '#dcfce7',
    fallback: 'OKR',
    title: 'Business Performance Manager',
    summary: '<strong>Turn strategy into accountable execution.</strong> Lead OKR design, governance, and coaching for clients pursuing measurable performance gains.',
    body: `
      <p><strong>Remote | 2-7 yrs Exp | Full-Time / Consulting Basis</strong></p>
      <h4>Job Summary</h4>
      <p>We are looking for dynamic, analytical, and business-savvy MBA professionals to lead and manage OKR (Objectives &amp; Key Results) implementation for our clients.</p>

      <h4>Key Responsibilities</h4>
      <ul>
        <li>Partner with clients to define, design, and implement customized OKR frameworks.</li>
        <li>Facilitate OKR workshops, strategy planning sessions, and alignment meetings.</li>
        <li>Provide ongoing coaching, tracking, and governance of client OKRs.</li>
        <li>Help leadership teams translate strategic goals into actionable OKRs.</li>
        <li>Identify roadblocks in goal execution and recommend solutions.</li>
        <li>Monitor client progress and report impact metrics and dashboards.</li>
        <li>Drive adoption of OKR best practices and tools such as WorkBoard, Weekdone, and GTMHub.</li>
        <li>Work closely with AI and technology teams for OKR-based analytics or automation.</li>
        <li>Act as the key point of contact between client leadership and internal delivery teams.</li>
      </ul>

      <h4>Required Qualifications</h4>
      <ul>
        <li>MBA from a recognized institution (specialization in Strategy, Operations, or HR is a plus).</li>
        <li>2-7 years of professional experience in consulting, program management, or strategy execution.</li>
        <li>Strong understanding of business planning, goal-setting methodologies, and performance metrics.</li>
        <li>Excellent communication, facilitation, and client-facing skills.</li>
        <li>Ability to manage multiple client accounts and stakeholder expectations.</li>
        <li>Comfortable with digital OKR platforms and collaborative tools such as Google Workspace, Trello, and Asana.</li>
      </ul>

      <h4>Preferred</h4>
      <ul>
        <li>Certification or hands-on experience in OKR frameworks.</li>
        <li>Experience in change management or Agile environments.</li>
        <li>Exposure to working with global clients in a cross-functional setup.</li>
      </ul>

      <h4>What You'll Gain</h4>
      <ul>
        <li>Opportunity to shape growth journeys for ambitious businesses.</li>
        <li>Leadership exposure and strategic thinking development.</li>
        <li>Work alongside seasoned AI and business transformation professionals.</li>
        <li>Growth potential into leadership or product strategy roles.</li>
      </ul>
    `
  },

  'gaming': {
    img: 'src/extra_img/GamingIndustry.webp',
    bgColor: '#dcfce7',
    fallback: '🎮',
    title: 'Gaming Industry with AI',
    summary: '<strong>Create more adaptive and engaging play.</strong> Use AI to improve gameplay, testing, personalization, environments, and player experience.',
    body: `
      <p>AI is transforming the gaming industry by improving gameplay, personalizing player experience, enhancing
      game design, automating testing, and enabling realistic environments.</p>

      <h4>Intelligent NPC Behaviour</h4>
      <p>AI makes Non-Playable Characters more realistic, adaptive to player actions, dynamic in combat, and capable of learning patterns — creating more engaging and unpredictable gameplay.</p>

      <h4>Personalized Player Experience</h4>
      <p>AI analyses player behaviour to adjust win patterns, recommend missions, personalize game paths, and suggest in-game purchases.</p>

      <h4>Realistic Physics &amp; Graphics</h4>
      <p>AI dynamically enhances character animations, facial expressions, motion capture, environmental effects, and realistic physics simulations to make games more cinematic and lifelike.</p>

      <h4>Automated Game Testing</h4>
      <ul>
        <li>Auto-test game levels and identify bugs</li>
        <li>Run thousands of test cases</li>
        <li>Simulate virtual users and complex gameplay patterns</li>
        <li>Validate performance and stability</li>
      </ul>
      <p>AI reduces QA cycles, improves game quality, and speeds time-to-market.</p>

      <h4>Adaptive Game Complexity</h4>
      <p>AI adjusts difficulty based on player skill, reaction time, and strategy styles to maintain the right balance between fun and challenge.</p>

      <h4>Game Storytelling &amp; Narrative Design</h4>
      <p>Generative AI can create dialogues, build story arcs, generate characters and expand missions dynamically to help developers create richer narratives.</p>
    `
  },

  'fintech': {
    img: 'src/extra_img/Fintech.webp',
    bgColor: '#dbeafe',
    fallback: '💳',
    title: 'FinTech with AI',
    summary: '<strong>Make financial services faster and smarter.</strong> Apply AI across risk, fraud, operations, support, and personalized decision-making.',
    body: `
      <p>AI is transforming the banking and financial services industry across risk, operations, customer experience,
      fraud prevention, and decision-making.</p>

      <h4>Risk Assessment &amp; Credit Scoring</h4>
      <p>Traditional credit scores only consider past financial behaviour. AI-powered scoring also includes spending patterns, cash flow, transaction history, and employment behaviour — leading to more accurate lending decisions.</p>

      <h4>Automation of Back-Office Processes</h4>
      <p>AI + RPA reduces manual work in KYC processing, document verification, loan approvals, account opening, compliance checks, cheque clearing, and reconciliation.</p>

      <h4>Customer Support &amp; Chatbots</h4>
      <p>AI-powered chatbots can answer queries, provide account information, block cards, reset passwords, and guide customers 24/7 — reducing call-centre dependency.</p>

      <h4>Personal Finance &amp; Wealth Management</h4>
      <p>AI helps customers manage money through spending analysis, personalized investment recommendations, robo-advisory services, and automated savings suggestions.</p>
    `
  },

  'insurtech': {
    img: 'src/extra_img/Insurance.webp',
    bgColor: '#fee2e2',
    fallback: '🛡️',
    title: 'InsurTech with AI',
    summary: '<strong>Modernize insurance workflows with intelligence.</strong> Improve claims, risk modelling, fraud checks, and customer support through AI.',
    body: `
      <p>AI is transforming the insurance industry across claims, customer experience, operations, fraud prevention,
      and risk modelling.</p>

      <h4>Automated Claims Processing</h4>
      <p>AI speeds up and improves accuracy in claims by automatically reading documents (OCR + NLP), validating policy details, assessing damage using photos/videos, and auto-approving simple claims.</p>

      <h4>Risk Assessment &amp; Pricing</h4>
      <p>AI models can predict risk more accurately, provide personalized pricing, adjust premiums dynamically, and identify high-risk policies earlier — helping insurers improve profitability and reduce losses.</p>

      <h4>Customer Service &amp; Chatbots</h4>
      <p>AI-powered agents provide 24/7 customer support, policy information, renewal reminders, claim status updates, and guidance for selecting policies.</p>

      <h4>Claims Damage Assessment</h4>
      <p>AI can analyse vehicle accident images, property damage photos, and health/medical reports to estimate claim amounts quickly and accurately.</p>

      <h4>Document Intelligence</h4>
      <p>AI automatically extracts information from KYC documents, hospital bills, repair estimates, medical records, and claim forms — speeding up onboarding and processing.</p>
    `
  },

  'healthtech': {
    img: 'src/extra_img/HealthTech.webp',
    bgColor: '#fce7f3',
    fallback: '🏥',
    title: 'HealthTech / MedTech with AI',
    summary: '<strong>Support faster, smarter care decisions.</strong> Use AI to improve diagnostics, imaging workflows, clinical documentation, and patient care.',
    body: `
      <p>AI is transforming healthcare across diagnostics, imaging, clinical documentation, and patient care.</p>

      <h4>Disease Diagnosis &amp; Early Detection</h4>
      <p>AI systems can analyze X-rays, CT scans, MRI scans, ultrasound images, and pathology slides — enabling faster and more accurate diagnosis.</p>

      <h4>Medical Imaging &amp; Analysis</h4>
      <p>AI-powered imaging tools can highlight abnormalities, assist radiologists, create 3D reconstructions, and detect micro-lesions invisible to the human eye — dramatically speeding up radiology workflows.</p>

      <h4>Clinical Documentation Automation</h4>
      <p>AI helps doctors by transcribing clinical notes, generating summaries, filling EHR fields automatically, and reducing manual paperwork — so doctors save time and focus more on patient care.</p>
    `
  },

  'edtech': {
    img: 'src/extra_img/EdTechWithAI.webp',
    bgColor: '#d1fae5',
    fallback: '📚',
    title: 'EdTech with AI',
    summary: '<strong>Make learning more personal and effective.</strong> Use AI to support students, teachers, assessments, content creation, and immersive education.',
    body: `
      <p>AI is transforming the education industry by personalizing learning, improving teaching efficiency,
      enhancing student outcomes, and automating administrative tasks.</p>

      <h4>Personalized Learning</h4>
      <p>AI tailors learning to each student by identifying strengths and weaknesses, giving personalized study plans, and recommending practice exercises — so students learn at their own pace.</p>

      <h4>Intelligent Tutoring Systems</h4>
      <p>AI-powered tutors can explain concepts, provide step-by-step solutions, clarify doubts 24/7, and give additional practice — enabling individualized support even outside class.</p>

      <h4>Automated Grading &amp; Assessment</h4>
      <p>AI can automatically grade objective tests, assignments, essays, quizzes, and homework submissions — speeding up evaluation and reducing teacher workload.</p>

      <h4>Smart Content Creation</h4>
      <p>AI can generate question banks, lesson summaries, class notes, practice worksheets, and study guides — saving teachers hours of content preparation time.</p>

      <h4>Virtual Classrooms &amp; Immersive Learning</h4>
      <p>AI supports AR/VR-based learning, virtual labs, simulated environments, and remote learning enhancements — making education more interactive.</p>
    `
  }
};

function convertSectionParagraphsToPoints(container) {
  container.querySelectorAll('h4').forEach((heading) => {
    const points = [];
    let next = heading.nextElementSibling;

    while (next && !['H3', 'H4', 'UL', 'OL'].includes(next.tagName)) {
      const current = next;
      next = next.nextElementSibling;

      if (current.tagName === 'P' && current.textContent.trim()) {
        points.push(current);
      }
    }

    if (!points.length) return;

    const list = document.createElement('ul');
    list.className = 'modal-key-points';

    points.forEach((point) => {
      const item = document.createElement('li');
      item.innerHTML = point.innerHTML;
      list.appendChild(item);
      point.remove();
    });

    heading.insertAdjacentElement('afterend', list);
  });
}

function openModal(key) {
  const data = modalData[key];
  if (!data) return;

  const overlay = document.getElementById('modalOverlay');
  const imgEl = document.getElementById('modalImg');
  const imgWrap = document.getElementById('modalImgWrap');
  const fallbackEl = document.getElementById('modalImgFallback');
  const titleEl = document.getElementById('modalTitle');
  const summaryEl = document.getElementById('modalSummary');
  const bodyEl = document.getElementById('modalBody');
  const contentWrap = document.querySelector('.modal-content-wrap');

  imgWrap.style.backgroundColor = data.bgColor || '#f3f4f6';

  if (data.img) {
    imgEl.src = data.img;
    imgEl.alt = data.title;
    imgEl.style.display = 'block';
    fallbackEl.style.display = 'none';
  } else {
    imgEl.style.display = 'none';
    fallbackEl.textContent = data.fallback || '';
    fallbackEl.style.display = 'block';
  }

  imgEl.onerror = function () {
    imgEl.style.display = 'none';
    fallbackEl.style.display = 'block';
  };

  titleEl.textContent = data.title;
  if (summaryEl) {
    summaryEl.innerHTML = data.summary || '';
    summaryEl.style.display = data.summary ? 'block' : 'none';
  }
  bodyEl.innerHTML = data.body;
  convertSectionParagraphsToPoints(bodyEl);
  bodyEl.scrollTop = 0;
  contentWrap?.scrollTo({ top: 0, behavior: 'auto' });

  overlay.classList.add('active');
  document.body.style.overflow = 'hidden';

  requestAnimationFrame(() => {
    bodyEl.scrollTop = 0;
    contentWrap?.scrollTo({ top: 0, behavior: 'auto' });
  });
}

function closeModal() {
  const bodyEl = document.getElementById('modalBody');
  const contentWrap = document.querySelector('.modal-content-wrap');

  document.getElementById('modalOverlay').classList.remove('active');
  document.body.style.overflow = '';
  bodyEl.scrollTop = 0;
  contentWrap?.scrollTo({ top: 0, behavior: 'auto' });
}

function handleOverlayClick(e) {
  if (e.target === document.getElementById('modalOverlay')) {
    closeModal();
  }
}

function openObjectoPreview(e) {
  if (e && e.preventDefault) e.preventDefault();

  const overlay = document.getElementById('objectoPreviewOverlay');
  if (!overlay) return false;

  overlay.classList.add('active');
  document.body.style.overflow = 'hidden';
  return false;
}

function closeObjectoPreview() {
  const overlay = document.getElementById('objectoPreviewOverlay');
  if (!overlay) return;

  overlay.classList.remove('active');
  document.body.style.overflow = '';
}

function handleObjectoPreviewOverlayClick(e) {
  if (e.target === document.getElementById('objectoPreviewOverlay')) {
    closeObjectoPreview();
  }
}

function exploreObjectoSection(e) {
  if (e && e.preventDefault) e.preventDefault();
  closeObjectoPreview();

  const navLink = document.querySelector('.nav-links a[href="#objecto"]');
  if (navLink) {
    navLink.click();
  }
}

document.addEventListener('keydown', function (e) {
  if (e.key !== 'Escape') return;
  closeModal();
  closeObjectoPreview();
});

