/**
 * DEVELOPER PORTFOLIO INTERACTIVITY ENGINE
 * Author: Deekshith Vataparthi Portfolio Script
 * Features: Interactive Canvas, Custom Lerped Cursor, GSAP ScrollTrigger, Typing Effect, 3D Card Tilt, GitHub Contribution Generator
 */
document.addEventListener('DOMContentLoaded', () => {
    // Initialize Lucide Icons
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
    // ==========================================================================
    // 1. Mobile Menu Toggle
    // ==========================================================================
    const mobileToggle = document.getElementById('mobile-toggle');
    const navMenu = document.getElementById('nav-menu');
    const navLinks = document.querySelectorAll('.nav-link');
    if (mobileToggle && navMenu) {
        mobileToggle.addEventListener('click', () => {
            mobileToggle.classList.toggle('active');
            navMenu.classList.toggle('open');
            // Toggle hamburger bars animation
            const bars = mobileToggle.querySelectorAll('.bar');
            if (navMenu.classList.contains('open')) {
                bars[0].style.transform = 'rotate(-45deg) translate(-5px, 6px)';
                bars[1].style.opacity = '0';
                bars[2].style.transform = 'rotate(45deg) translate(-5px, -6px)';
            } else {
                bars[0].style.transform = 'none';
                bars[1].style.opacity = '1';
                bars[2].style.transform = 'none';
            }
        });
        // Close menu on click of nav link
        navLinks.forEach(link => {
            link.addEventListener('click', () => {
                mobileToggle.classList.remove('active');
                navMenu.classList.remove('open');
                const bars = mobileToggle.querySelectorAll('.bar');
                bars[0].style.transform = 'none';
                bars[1].style.opacity = '1';
                bars[2].style.transform = 'none';
            });
        });
    }
    // Active Navigation Link on Scroll
    const sections = document.querySelectorAll('section');
    window.addEventListener('scroll', () => {
        let current = '';
        sections.forEach(section => {
            const sectionTop = section.offsetTop;
            const sectionHeight = section.clientHeight;
            if (pageYOffset >= (sectionTop - 200)) {
                current = section.getAttribute('id');
            }
        });
        navLinks.forEach(link => {
            link.classList.remove('active');
            if (link.getAttribute('href').includes(current)) {
                link.classList.add('active');
            }
        });
    });
    // ==========================================================================
    // 2. Custom Cursor Lerp (Linear Interpolation)
    // ==========================================================================
    const cursorDot = document.getElementById('cursor-dot');
    const cursorOutline = document.getElementById('cursor-outline');
    let mouseX = 0;
    let mouseY = 0;
    let outlineX = 0;
    let outlineY = 0;
    // Track actual mouse coordinates
    window.addEventListener('mousemove', (e) => {
        mouseX = e.clientX;
        mouseY = e.clientY;
        // Position the inner dot immediately
        if (cursorDot) {
            cursorDot.style.left = `${mouseX}px`;
            cursorDot.style.top = `${mouseY}px`;
        }
    });
    // Lerp logic for smooth outer ring delay tracking
    function animateCursor() {
        const speed = 0.15; // lerp speed index (0-1)
        
        outlineX += (mouseX - outlineX) * speed;
        outlineY += (mouseY - outlineY) * speed;
        if (cursorOutline) {
            cursorOutline.style.left = `${outlineX}px`;
            cursorOutline.style.top = `${outlineY}px`;
        }
        requestAnimationFrame(animateCursor);
    }
    animateCursor();
    // Hover Target Expansion Class
    const hoverTargets = document.querySelectorAll('.hover-target');
    hoverTargets.forEach(target => {
        target.addEventListener('mouseenter', () => {
            document.body.classList.add('cursor-hover');
        });
        target.addEventListener('mouseleave', () => {
            document.body.classList.remove('cursor-hover');
        });
    });
    // ==========================================================================
    // 3. Interactive HTML5 Particle Network Canvas
    // ==========================================================================
    const canvas = document.getElementById('particle-canvas');
    const ctx = canvas ? canvas.getContext('2d') : null;
    let particlesArray = [];
    // Mouse coordinates inside canvas space
    let canvasMouse = {
        x: null,
        y: null,
        radius: 120 // Connection/repulsion radius
    };
    window.addEventListener('mousemove', (e) => {
        canvasMouse.x = e.clientX;
        canvasMouse.y = e.clientY;
    });
    window.addEventListener('mouseleave', () => {
        canvasMouse.x = null;
        canvasMouse.y = null;
    });
    if (canvas && ctx) {
        // Adjust sizing
        const resizeCanvas = () => {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
            initParticles();
        };
        // Particle Class definition
        class Particle {
            constructor(x, y, directionX, directionY, size, color) {
                this.x = x;
                this.y = y;
                this.directionX = directionX;
                this.directionY = directionY;
                this.size = size;
                this.color = color;
            }
            // Draw individual node
            draw() {
                ctx.beginPath();
                ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2, false);
                ctx.fillStyle = this.color;
                ctx.fill();
            }
            // Move particle and handle collision boundary/mouse repulsion
            update() {
                // Screen boundary check
                if (this.x > canvas.width || this.x < 0) {
                    this.directionX = -this.directionX;
                }
                if (this.y > canvas.height || this.y < 0) {
                    this.directionY = -this.directionY;
                }
                // Check mouse proximity for repulsion
                if (canvasMouse.x !== null && canvasMouse.y !== null) {
                    let dx = canvasMouse.x - this.x;
                    let dy = canvasMouse.y - this.y;
                    let distance = Math.sqrt(dx*dx + dy*dy);
                    
                    if (distance < canvasMouse.radius) {
                        const forceDirectionX = dx / distance;
                        const forceDirectionY = dy / distance;
                        const force = (canvasMouse.radius - distance) / canvasMouse.radius;
                        
                        // Push away from mouse
                        this.x -= forceDirectionX * force * 3;
                        this.y -= forceDirectionY * force * 3;
                    }
                }
                // Normal drift motion
                this.x += this.directionX;
                this.y += this.directionY;
                this.draw();
            }
        }
        // Initialize particle array based on viewport width
        function initParticles() {
            particlesArray = [];
            let numberOfParticles = Math.floor((canvas.width * canvas.height) / 13000);
            
            // Limit density for rendering performance
            if (numberOfParticles > 120) numberOfParticles = 120;
            if (numberOfParticles < 30) numberOfParticles = 30;
            for (let i = 0; i < numberOfParticles; i++) {
                let size = (Math.random() * 2) + 1;
                let x = (Math.random() * ((canvas.width - size * 2) - (size * 2)) + size * 2);
                let y = (Math.random() * ((canvas.height - size * 2) - (size * 2)) + size * 2);
                let directionX = (Math.random() * 0.4) - 0.2;
                let directionY = (Math.random() * 0.4) - 0.2;
                
                // Color choices: subtle cyan or subtle purple
                let color = Math.random() > 0.5 ? 'rgba(0, 242, 254, 0.4)' : 'rgba(127, 0, 255, 0.3)';
                particlesArray.push(new Particle(x, y, directionX, directionY, size, color));
            }
        }
        // Draw connections lines between near particles
        function connect() {
            let opacityValue = 1;
            for (let a = 0; a < particlesArray.length; a++) {
                for (let b = a; b < particlesArray.length; b++) {
                    let dx = particlesArray[a].x - particlesArray[b].x;
                    let dy = particlesArray[a].y - particlesArray[b].y;
                    let distance = Math.sqrt(dx*dx + dy*dy);
                    
                    const maxDistance = 110;
                    if (distance < maxDistance) {
                        opacityValue = 1 - (distance / maxDistance);
                        ctx.strokeStyle = `rgba(100, 116, 139, ${opacityValue * 0.15})`;
                        ctx.lineWidth = 1;
                        ctx.beginPath();
                        ctx.moveTo(particlesArray[a].x, particlesArray[a].y);
                        ctx.lineTo(particlesArray[b].x, particlesArray[b].y);
                        ctx.stroke();
                    }
                }
            }
        }
        // Animation frame loop
        function animate() {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            for (let i = 0; i < particlesArray.length; i++) {
                particlesArray[i].update();
            }
            connect();
            requestAnimationFrame(animate);
        }
        window.addEventListener('resize', resizeCanvas);
        resizeCanvas();
        animate();
    }
    // ==========================================================================
    // 4. Hero Subtitle Typing & Erasing Animation
    // ==========================================================================
    const words = ["AI/ML Developer", "Full Stack Engineer", "Problem Solver"];
    let wordIndex = 0;
    let charIndex = 0;
    let isDeleting = false;
    const typingDelay = 120;
    const erasingDelay = 60;
    const wordPause = 2000; // Pause showing complete word
    const typingTextEl = document.getElementById('typing-text');
    function type() {
        if (!typingTextEl) return;
        const currentWord = words[wordIndex];
        if (isDeleting) {
            // Remove character
            typingTextEl.textContent = currentWord.substring(0, charIndex - 1);
            charIndex--;
        } else {
            // Add character
            typingTextEl.textContent = currentWord.substring(0, charIndex + 1);
            charIndex++;
        }
        // Determine delay speed
        let delay = isDeleting ? erasingDelay : typingDelay;
        // Word typing complete
        if (!isDeleting && charIndex === currentWord.length) {
            isDeleting = true;
            delay = wordPause; // pause at end of word
        } else if (isDeleting && charIndex === 0) {
            isDeleting = false;
            wordIndex = (wordIndex + 1) % words.length; // cycle word index
            delay = 300; // brief pause before next word
        }
        setTimeout(type, delay);
    }
    
    // Start typing cycle
    if (typingTextEl) {
        setTimeout(type, 1000);
    }
    // ==========================================================================
    // 5. 3D Project Cards Hover Tilt Effect
    // ==========================================================================
    const projectCards = document.querySelectorAll('.project-card');
    
    projectCards.forEach(card => {
        card.addEventListener('mousemove', (e) => {
            const rect = card.getBoundingClientRect();
            const x = e.clientX - rect.left; // x position within element
            const y = e.clientY - rect.top;  // y position within element
            
            // Map dimensions to tilt values (-10deg to 10deg)
            const centerX = rect.width / 2;
            const centerY = rect.height / 2;
            
            const rotateX = ((centerY - y) / centerY) * 8; // Max rotation 8deg
            const rotateY = ((x - centerX) / centerX) * 8;
            
            card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateY(-8px)`;
        });
        
        card.addEventListener('mouseleave', () => {
            card.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg) translateY(0deg)';
        });
    });
    // ==========================================================================
    // 6. Interactive Projects Filter Category
    // ==========================================================================
    const filterBtns = document.querySelectorAll('.filter-btn');
    
    filterBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            // Set active class
            filterBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const filterValue = btn.getAttribute('data-filter');
            projectCards.forEach(card => {
                const category = card.getAttribute('data-category');
                
                // Animate filter hide/reveal
                if (filterValue === 'all' || category === filterValue) {
                    card.style.display = 'flex';
                    setTimeout(() => {
                        card.style.opacity = '1';
                        card.style.transform = 'scale(1)';
                    }, 50);
                } else {
                    card.style.opacity = '0';
                    card.style.transform = 'scale(0.9)';
                    setTimeout(() => {
                        card.style.display = 'none';
                    }, 300);
                }
            });
        });
    });
    // ==========================================================================
    // 7. GitHub Contribution Matrix Generator
    // ==========================================================================
    const gitGrid = document.getElementById('git-contribution-grid');
    
    if (gitGrid) {
        // Create 371 cells (53 columns x 7 rows)
        const cellCount = 371;
        const fragment = document.createDocumentFragment();
        for (let i = 0; i < cellCount; i++) {
            const cell = document.createElement('div');
            cell.classList.add('grid-cell');
            
            // Randomize density levels (mostly low commits, some higher peaks)
            const roll = Math.random();
            let level = 0;
            if (roll > 0.85) level = 4;
            else if (roll > 0.7) level = 3;
            else if (roll > 0.5) level = 2;
            else if (roll > 0.25) level = 1;
            
            cell.classList.add(`level-${level}`);
            
            // Add tooltips
            const date = new Date();
            date.setDate(date.getDate() - (cellCount - i));
            const dateString = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
            const commits = level === 0 ? 'No' : level * Math.floor(Math.random() * 3 + 1);
            cell.setAttribute('title', `${commits} commits on ${dateString}`);
            
            fragment.appendChild(cell);
        }
        gitGrid.appendChild(fragment);
    }
    // ==========================================================================
    // 8. Stats Counter Count-Up Animation (on scroll-into-view)
    // ==========================================================================
    const statNumbers = document.querySelectorAll('.stat-number');
    let animatedStats = false;
    const animateStatsCount = () => {
        statNumbers.forEach(stat => {
            const target = parseInt(stat.getAttribute('data-target'), 10);
            let count = 0;
            const duration = 2000; // 2 seconds
            const speed = target / (duration / 16); // ~60fps refresh interval
            const updateCount = () => {
                count += speed;
                if (count < target) {
                    stat.textContent = Math.floor(count);
                    requestAnimationFrame(updateCount);
                } else {
                    stat.textContent = target + (target === 500 ? '+' : ''); // add plus indicator if target is 500
                }
            };
            updateCount();
        });
    };
    // ==========================================================================
    // 9. Intersection Observer (Scroll Reveal Animations Fallback)
    // ==========================================================================
    const revealElements = document.querySelectorAll('.scroll-reveal');
    const skillBars = document.querySelectorAll('.skill-bar-fill');
    const statsSection = document.getElementById('github');
    const revealObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('revealed');
                observer.unobserve(entry.target);
            }
        });
    }, {
        threshold: 0.15,
        rootMargin: '0px 0px -50px 0px'
    });
    revealElements.forEach(el => revealObserver.observe(el));
    // Stats counter scroll observer
    const statsObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting && !animatedStats) {
                animateStatsCount();
                animatedStats = true;
                observer.unobserve(entry.target);
            }
        });
    }, { threshold: 0.2 });
    if (statsSection) {
        statsObserver.observe(statsSection);
    }
    // Skills section animation triggers
    const skillsSection = document.getElementById('skills');
    const skillsObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                // Populate/Expand skill bar widths on load
                skillBars.forEach(bar => {
                    const widthVal = bar.getAttribute('style').split('width:')[1];
                    bar.style.width = widthVal;
                });
                observer.unobserve(entry.target);
            }
        });
    }, { threshold: 0.1 });
    if (skillsSection) {
        skillsObserver.observe(skillsSection);
    }
    // ==========================================================================
    // 10. GSAP ScrollTrigger Premium Integrations
    // ==========================================================================
    if (typeof gsap !== 'undefined') {
        // Register scroll trigger
        if (typeof ScrollTrigger !== 'undefined') {
            gsap.registerPlugin(ScrollTrigger);
        }
        // Hero Timeline Entrances
        const heroTimeline = gsap.timeline({ defaults: { ease: 'power4.out', duration: 1 } });
        
        heroTimeline.fromTo('.navbar', 
            { y: -80, opacity: 0 }, 
            { y: 0, opacity: 1, duration: 1.2 }
        );
        
        heroTimeline.fromTo('.hero-section .animate-item', 
            { y: 50, opacity: 0 }, 
            { y: 0, opacity: 1, stagger: 0.15 },
            '-=0.8'
        );
        // GSAP ScrollTrigger reveals if ScrollTrigger is successfully loaded
        if (typeof ScrollTrigger !== 'undefined') {
            
            // Skill cards reveal stagger
            gsap.from('.skills-card', {
                scrollTrigger: {
                    trigger: '.skills-categories-grid',
                    start: 'top 80%',
                    toggleActions: 'play none none none'
                },
                y: 60,
                opacity: 0,
                duration: 0.8,
                stagger: 0.15,
                ease: 'power3.out'
            });
            // Project cards reveal stagger
            gsap.from('.project-card', {
                scrollTrigger: {
                    trigger: '.project-grid',
                    start: 'top 85%',
                    toggleActions: 'play none none none'
                },
                y: 80,
                opacity: 0,
                duration: 1,
                stagger: 0.2,
                ease: 'power3.out'
            });
            
            // Timeline entrance
            gsap.from('.timeline-item', {
                scrollTrigger: {
                    trigger: '.timeline',
                    start: 'top 80%',
                },
                x: -50,
                opacity: 0,
                duration: 1,
                stagger: 0.3,
                ease: 'power3.out'
            });
        }
    }
    // ==========================================================================
    // 11. Interactive Contact Form with Regex Verification
    // ==========================================================================
    const contactForm = document.getElementById('portfolio-contact-form');
    const successAlert = document.getElementById('form-success-alert');
    if (contactForm) {
        contactForm.addEventListener('submit', (e) => {
            e.preventDefault();
            // Inputs
            const nameEl = document.getElementById('form-name');
            const emailEl = document.getElementById('form-email');
            const subjectEl = document.getElementById('form-subject');
            const messageEl = document.getElementById('form-message');
            let isValid = true;
            // Reset validation states
            [nameEl, emailEl, subjectEl, messageEl].forEach(el => {
                if (el) el.classList.remove('invalid');
            });
            // Name Check
            if (!nameEl.value.trim()) {
                nameEl.classList.add('invalid');
                isValid = false;
            }
            // Email Check using regex
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailEl.value.trim() || !emailRegex.test(emailEl.value)) {
                emailEl.classList.add('invalid');
                isValid = false;
            }
            // Subject Check
            if (!subjectEl.value.trim()) {
                subjectEl.classList.add('invalid');
                isValid = false;
            }
            // Message Check
            if (!messageEl.value.trim()) {
                messageEl.classList.add('invalid');
                isValid = false;
            }
            if (isValid) {
                // Show Mock submitting process
                const submitBtn = contactForm.querySelector('button[type="submit"]');
                const originalText = submitBtn.innerHTML;
                
                submitBtn.disabled = true;
                submitBtn.innerHTML = '<span>Sending digital signal...</span> <i data-lucide="loader-2" class="btn-icon animate-spin"></i>';
                if (typeof lucide !== 'undefined') {
                    lucide.createIcons(); // refresh icon
                }
                // Add spinning animation class to loaders
                const spinner = submitBtn.querySelector('.animate-spin');
                if (spinner) {
                    spinner.style.animation = 'blink 1s infinite linear';
                }
                // Mock API Delay
                setTimeout(() => {
                    submitBtn.disabled = false;
                    submitBtn.innerHTML = originalText;
                    if (typeof lucide !== 'undefined') {
                        lucide.createIcons();
                    }
                    // Reset fields
                    contactForm.reset();
                    // Display success notification
                    if (successAlert) {
                        successAlert.classList.add('show');
                        setTimeout(() => {
                            successAlert.classList.remove('show');
                        }, 5000); // hide alert after 5 seconds
                    }
                }, 2000);
            }
        });
    }
    // Resume Download Mock Handler
    const downloadResumeBtn = document.getElementById('download-resume-btn');
    if (downloadResumeBtn) {
        downloadResumeBtn.addEventListener('click', (e) => {
            e.preventDefault();
            // Generate dummy PDF file download block
            const dummyContent = "%PDF-1.4 ... (Deekshith Vataparthi Portfolio Resume Placeholder)";
            const blob = new Blob([dummyContent], { type: 'application/pdf' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'Deekshith_Vataparthi_Resume.pdf';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        });
    }
});
