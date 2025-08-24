// Main JavaScript file for the Express EJS app

document.addEventListener('DOMContentLoaded', function() {
    // Add smooth scrolling to anchor links
    const links = document.querySelectorAll('a[href^="#"]');
    links.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const targetId = this.getAttribute('href').substring(1);
            const targetElement = document.getElementById(targetId);
            if (targetElement) {
                targetElement.scrollIntoView({
                    behavior: 'smooth'
                });
            }
        });
    });

    // Add active navigation highlighting
    const currentPath = window.location.pathname;
    const navLinks = document.querySelectorAll('.nav-link');
    navLinks.forEach(link => {
        if (link.getAttribute('href') === currentPath) {
            link.style.backgroundColor = 'rgba(255,255,255,0.2)';
        }
    });

    // Form validation and enhancement
    const contactForm = document.querySelector('.contact-form');
    if (contactForm) {
        contactForm.addEventListener('submit', function(e) {
            const name = this.querySelector('#name').value.trim();
            const email = this.querySelector('#email').value.trim();
            const message = this.querySelector('#message').value.trim();

            if (!name || !email || !message) {
                e.preventDefault();
                alert('Please fill in all required fields.');
                return false;
            }

            // Add loading state to submit button
            const submitBtn = this.querySelector('button[type="submit"]');
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sending...';
            submitBtn.disabled = true;
        });
    }

    // Add hover effects to cards
    const cards = document.querySelectorAll('.feature-card, .info-card, .team-card');
    cards.forEach(card => {
        card.addEventListener('mouseenter', function() {
            this.style.transform = 'translateY(-5px)';
        });
        
        card.addEventListener('mouseleave', function() {
            this.style.transform = 'translateY(0)';
        });
    });

    // Animate stats on scroll
    const statsSection = document.querySelector('.stats-section');
    if (statsSection) {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const statNumbers = entry.target.querySelectorAll('.stat-number');
                    statNumbers.forEach(stat => {
                        const finalNumber = stat.textContent.replace('+', '');
                        const number = parseInt(finalNumber);
                        animateNumber(stat, 0, number, 2000);
                    });
                    observer.unobserve(entry.target);
                }
            });
        });
        observer.observe(statsSection);
    }

    function animateNumber(element, start, end, duration) {
        const range = end - start;
        const increment = range / (duration / 16);
        let current = start;
        
        const timer = setInterval(() => {
            current += increment;
            if (current >= end) {
                current = end;
                clearInterval(timer);
            }
            element.textContent = Math.floor(current) + '+';
        }, 16);
    }
});

// Add page transition effects
window.addEventListener('beforeunload', function() {
    document.body.style.opacity = '0.7';
    document.body.style.transform = 'scale(0.98)';
});

// Scanner functionality
document.addEventListener('DOMContentLoaded', function() {
    const scanInputs = document.querySelectorAll('.scan-input');
    
    scanInputs.forEach(input => {
        const scannerMode = input.dataset.scannerMode;
        
        if (scannerMode === 'physical') {
            let inputTimer;
            let lastInputTime = 0;
            
            input.addEventListener('input', function(e) {
                const currentTime = Date.now();
                const timeDiff = currentTime - lastInputTime;
                lastInputTime = currentTime;
                
                // Clear existing timer
                clearTimeout(inputTimer);
                
                // If input is coming fast (likely from scanner)
                if (timeDiff < 100 && this.value.length > 1) {
                    // Set timer to auto-submit or move to next field
                    inputTimer = setTimeout(() => {
                        const form = this.closest('form');
                        const inputs = Array.from(form.querySelectorAll('.scan-input'));
                        const currentIndex = inputs.indexOf(this);
                        
                        // If this is the last input or single input form, submit
                        if (currentIndex === inputs.length - 1) {
                            form.submit();
                        } else {
                            // Move to next input
                            const nextInput = inputs[currentIndex + 1];
                            if (nextInput) {
                                nextInput.focus();
                            }
                        }
                    }, 100);
                }
            });
            
            // Handle Enter key for physical scanners
            input.addEventListener('keypress', function(e) {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    const form = this.closest('form');
                    const inputs = Array.from(form.querySelectorAll('.scan-input'));
                    const currentIndex = inputs.indexOf(this);
                    
                    if (currentIndex === inputs.length - 1) {
                        form.submit();
                    } else {
                        const nextInput = inputs[currentIndex + 1];
                        if (nextInput) {
                            nextInput.focus();
                        }
                    }
                }
            });
        }
    });
});