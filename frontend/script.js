document.addEventListener('DOMContentLoaded', () => {
    // --- Get DOM Elements ---
    const imageUpload = document.getElementById('imageUpload');
    const uploadButton = document.getElementById('uploadButton');
    const imagePreview = document.getElementById('imagePreview');
    const predictButton = document.getElementById('predictButton');
    const resultDiv = document.getElementById('result');
    const canvas = document.getElementById('animatedBackground');
    const ctx = canvas.getContext('2d');

    let uploadedFile = null;
    let particles = [];
    let animationFrameId;

    // --- File Upload Logic ---

    // Trigger file input when custom button is clicked
    uploadButton.addEventListener('click', () => {
        imageUpload.click();
    });

    // Handle file selection
    imageUpload.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (file) {
            uploadedFile = file;
            
            // Show image preview
            const reader = new FileReader();
            reader.onload = (e) => {
                imagePreview.src = e.target.result;
                imagePreview.style.display = 'block';
            };
            reader.readAsDataURL(file);

            // Show predict button and clear previous results
            predictButton.style.display = 'inline-block';
            resultDiv.innerHTML = '';
        }
    });

    // --- MOCK API FUNCTION (For UI testing) ---
    // This function *pretends* to be your Python server.
    function mockApiCall(formData) {
        console.log("Mock API called with file:", formData.get('file').name);
        
        return new Promise((resolve) => {
            // Simulate a network delay
            setTimeout(() => {
                // Simulate a random prediction for more dynamic testing
                const isFake = Math.random() > 0.5; // 50% chance of being fake
                const confidence = (Math.random() * (0.99 - 0.70) + 0.70) * 100; // 70-99% confidence

                const mockData = {
                    prediction: isFake ? 'Deepfake Detected!' : 'Authentic Image',
                    confidence: `${confidence.toFixed(2)}%`
                };
                
                resolve({
                    ok: true,
                    json: () => Promise.resolve(mockData)
                });

                // --- To test your error handling, uncomment this block: ---
                // const mockError = { error: 'Mock Error: Image is unreadable' };
                // resolve({
                //     ok: false,
                //     json: () => Promise.resolve(mockError)
                // });

            }, 1800); // 1.8 second delay
        });
    }

    // --- Prediction Button Logic ---
    predictButton.addEventListener('click', async () => {
        if (!uploadedFile) {
            alert('Please select an image first.');
            return;
        }

        const formData = new FormData();
        formData.append('file', uploadedFile);

        // Show loading state
        resultDiv.innerHTML = '<span class="loading-text">Analyzing image data...</span>';
        predictButton.disabled = true;

        try {
            // ===================================================
            // STEP 1: MOCK CALL (NOW COMMENTED OUT)
            // ===================================================
            // const response = await mockApiCall(formData);
            
            // ===================================================
            // STEP 2: REAL CALL (NOW ENABLED)
            // ===================================================
            const response = await fetch('http://127.0.0.1:5000/predict', {
                method: 'POST',
                body: formData,
            });
            // ===================================================

            const data = await response.json();

            if (response.ok) {
                // Display the result
                resultDiv.innerHTML = `
                    <span class="${data.prediction === 'Deepfake Detected!' ? 'fake-result' : 'real-result'}">
                        <strong>${data.prediction}</strong> <br>
                        Confidence: ${data.confidence}
                    </span>
                `;
                // Add specific styling for result text
                const resultSpan = resultDiv.querySelector('span');
                if (data.prediction === 'Deepfake Detected!') {
                    resultSpan.style.color = '#ff4081'; // Pink for fake
                    resultSpan.style.textShadow = '0 0 10px rgba(255, 64, 129, 0.7)';
                } else {
                    resultSpan.style.color = '#00e676'; // Green for real
                    resultSpan.style.textShadow = '0 0 10px rgba(0, 230, 118, 0.7)';
                }

            } else {
                // Display error from the server
                resultDiv.innerHTML = `<span class="error-text">Error: ${data.error}</span>`;
                resultDiv.style.color = '#f44336'; // Red for errors
                resultDiv.style.textShadow = '0 0 8px rgba(244, 67, 54, 0.7)';
            }

        } catch (error) {
            // Display network or other errors
            console.error('Network Error:', error);
            resultDiv.innerHTML = '<span class="error-text">Error: Could not connect to the analysis server.</span>';
            resultDiv.style.color = '#f44336';
            resultDiv.style.textShadow = '0 0 8px rgba(244, 67, 54, 0.7)';
        } finally {
            // Re-enable the button
            predictButton.disabled = false;
        }
    });

    // --- ANIMATED BACKGROUND SCRIPT ---

    // Set canvas size
    function setCanvasSize() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    }

    // Particle class
    class Particle {
        constructor(x, y, radius, color, velocity) {
            this.x = x;
            this.y = y;
            this.radius = radius;
            this.color = color;
            this.velocity = velocity;
            this.alpha = 1; // Initial opacity
            this.fadeSpeed = 0.005; // How fast it fades
        }

        draw() {
            ctx.save();
            ctx.globalAlpha = this.alpha;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2, false);
            ctx.shadowColor = this.color;
            ctx.shadowBlur = this.radius * 2; // Create a glow effect
            ctx.fillStyle = this.color;
            ctx.fill();
            ctx.restore();
        }

        update() {
            this.x += this.velocity.x;
            this.y += this.velocity.y;
            this.alpha -= this.fadeSpeed; // Fade out

            // If particle fades out or goes off screen, reset it
            if (this.alpha <= 0 || this.x + this.radius < 0 || this.x - this.radius > canvas.width ||
                this.y + this.radius < 0 || this.y - this.radius > canvas.height) {
                this.reset();
            }
        }

        reset() {
            // Random start position near screen edge
            const edge = Math.floor(Math.random() * 4); // 0: top, 1: right, 2: bottom, 3: left
            switch(edge) {
                case 0: // Top
                    this.x = Math.random() * canvas.width;
                    this.y = -this.radius;
                    break;
                case 1: // Right
                    this.x = canvas.width + this.radius;
                    this.y = Math.random() * canvas.height;
                    break;
                case 2: // Bottom
                    this.x = Math.random() * canvas.width;
                    this.y = canvas.height + this.radius;
                    break;
                case 3: // Left
                    this.x = -this.radius;
                    this.y = Math.random() * canvas.height;
                    break;
            }
            this.radius = Math.random() * 2 + 1; // 1 to 3 pixels
            // Use your defined accent colors or similar glowing tones
            const colors = ['#00e676', '#6200ea', '#03dac6', '#ff4081'];
            this.color = colors[Math.floor(Math.random() * colors.length)];
            this.velocity = {
                x: (Math.random() - 0.5) * 0.8, // Slow random movement
                y: (Math.random() - 0.5) * 0.8
            };
            this.alpha = 1;
            this.fadeSpeed = Math.random() * 0.002 + 0.003; // Slightly varied fade speed
        }
    }

    // Initialize particles
    function initParticles() {
        particles = [];
        const numberOfParticles = 80; // Adjust for density
        for (let i = 0; i < numberOfParticles; i++) {
            const p = new Particle(0, 0, 0, '', {x:0, y:0});
            p.reset(); // Initial reset to set random properties
            particles.push(p);
        }
    }

    // Animation loop
    function animateParticles() {
        animationFrameId = requestAnimationFrame(animateParticles);
        ctx.clearRect(0, 0, canvas.width, canvas.height); 

        particles.forEach(particle => {
            particle.update();
            particle.draw();
        });
    }

    // --- Start everything ---
    setCanvasSize();
    initParticles();
    animateParticles();

    // Handle window resizing
    window.addEventListener('resize', () => {
        setCanvasSize();
        // Re-initialize particles to adapt to new size
        initParticles(); 
    });

    // Cleanup on page unload (optional)
    window.addEventListener('beforeunload', () => {
        cancelAnimationFrame(animationFrameId);
    });

});