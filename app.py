import os
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from tensorflow.keras.models import load_model
import numpy as np
from PIL import Image
import io

# Initialize the Flask app
# We tell Flask that our static files (HTML, CSS, JS) are in the 'frontend' folder
app = Flask(__name__, static_folder='frontend', static_url_path='')
CORS(app) # Enable Cross-Origin Resource Sharing

# --- Model Loading ---
# Load your pre-trained model
# This happens ONLY ONCE when the server starts
try:
    model = load_model('resnet_model.h5')
    print("✅ Model loaded successfully!")
except Exception as e:
    print(f"Error loading model: {e}")
    model = None

# ‼️ IMPORTANT: Define the expected image size for your model
# You MUST check your 'python.ipynb' notebook to find the correct size.
# I am GUESSING 224x224, which is common for ResNet.
MODEL_IMAGE_SIZE = (224, 224) 

# --- Image Preprocessing Function ---
# This function must be IDENTICAL to the one used during training
def preprocess_image(image_file):
    try:
        # Read the image file from the request
        img = Image.open(image_file.stream).convert('RGB')
        
        # Resize to the model's expected input size
        img = img.resize(MODEL_IMAGE_SIZE)
        
        # Convert to a NumPy array
        img_array = np.asarray(img)
        
        # Expand dimensions to create a "batch" of 1
        # Shape changes from (224, 224, 3) to (1, 224, 224, 3)
        img_array = np.expand_dims(img_array, axis=0)
        
        # ‼️ IMPORTANT: Normalize the image
        # Check your notebook! Was it /255.0? Or did you use a special function?
        # Using /255.0 as a common example.
        img_array = img_array / 255.0
        
        return img_array
    except Exception as e:
        print(f"Error preprocessing image: {e}")
        return None

# --- API Endpoint for Prediction ---
@app.route('/predict', methods=['POST'])
def predict():
    if model is None:
        return jsonify({'error': 'Model is not loaded'}), 500

    # Check if a file was sent
    if 'file' not in request.files:
        return jsonify({'error': 'No file part in the request'}), 400
    
    file = request.files['file']

    # Check if the file is empty
    if file.filename == '':
        return jsonify({'error': 'No file selected'}), 400

    if file:
        try:
            # 1. Preprocess the image
            processed_image = preprocess_image(file)
            if processed_image is None:
                return jsonify({'error': 'Failed to process image'}), 400

            # 2. Make a prediction
            prediction = model.predict(processed_image)
            
            # 3. Interpret the prediction
            score = float(prediction[0][0]) # Get the scalar value

            # --- START OF LOGIC FIX ---
            
            # DIAGNOSIS: The model is not well-trained.
            # It outputs a score near 0.01 for REAL images.
            # It outputs a score near 0.2-0.4 for FAKE images.
            # The 0.5 threshold is wrong. We must use a threshold BETWEEN these values.
            
            THRESHOLD = 0.15  # Our new boundary

            if score > THRESHOLD:
                # This is a FAKE image (score is ~0.2-0.4)
                label = "Deepfake Detected!"
                # The 'score' is the model's (low) confidence that it's fake.
                confidence = score
            else:
                # This is a REAL image (score is ~0.01)
                label = "Authentic Image"
                # The confidence is (1.0 - score)
                confidence = 1.0 - score
            
            # --- END OF LOGIC FIX ---


            # 4. Send the result back to the frontend as JSON
            return jsonify({
                'prediction': label,
                'confidence': f"{confidence * 100:.2f}%"
            })

        except Exception as e:
            return jsonify({'error': f'Prediction failed: {str(e)}'}), 500

# --- Route to Serve the Frontend ---
# This serves your index.html file from the 'frontend' folder
@app.route('/')
def index():
    # Flask will automatically look for 'index.html' in the 'static_folder'
    return app.send_static_file('index.html')

# --- Run the Server ---
if __name__ == '__main__':
    # Use port 5000 (standard for Flask)
    app.run(debug=True, port=5000)