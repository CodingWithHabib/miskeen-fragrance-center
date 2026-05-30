/* ════════════════════════════════════════════════════════════════
   CLOUDINARY MODULE — Image Upload & Management
════════════════════════════════════════════════════════════════ */

import { STORE } from '../config.js';

/* ════════════════════════════════════════════════════════════════
   CLOUDINARY CONFIGURATION
════════════════════════════════════════════════════════════════ */

let cloudName = 'YOUR_CLOUD_NAME';
let uploadPreset = 'miskeen_unsigned';

/* ════════════════════════════════════════════════════════════════
   INITIALIZATION
════════════════════════════════════════════════════════════════ */

function initializeCloudinary() {
  // Load settings from STORE
  updateCloudinaryConfig();

  console.log('✅ Cloudinary module initialized');
}

function updateCloudinaryConfig() {
  cloudName = STORE.cloudName || 'YOUR_CLOUD_NAME';
  uploadPreset = STORE.uploadPreset || 'miskeen_unsigned';
  console.log('Cloudinary config updated:', { cloudName, uploadPreset });
}

/* ════════════════════════════════════════════════════════════════
   IMAGE COMPRESSION
════════════════════════════════════════════════════════════════ */

async function compressImage(file, maxDimension = 1000, quality = 0.82) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);

      let { width, height } = img;

      // Resize if too large
      if (width > maxDimension || height > maxDimension) {
        if (width > height) {
          height = Math.round((height * maxDimension) / width);
          width = maxDimension;
        } else {
          width = Math.round((width * maxDimension) / height);
          height = maxDimension;
        }
      }

      // Create canvas and compress
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error('Failed to compress image'));
          }
        },
        'image/jpeg',
        quality
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image for compression'));
    };

    img.src = url;
  });
}

/* ════════════════════════════════════════════════════════════════
   IMAGE VALIDATION
════════════════════════════════════════════════════════════════ */

function validateImageFile(file) {
  if (!file) {
    return 'Please select an image file.';
  }

  if (!file.type.startsWith('image/')) {
    return 'Please select a valid image file (JPG, PNG, WebP).';
  }

  const maxSize = 10 * 1024 * 1024; // 10MB
  if (file.size > maxSize) {
    return 'Image file is too large. Maximum size is 10MB.';
  }

  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  if (!allowedTypes.includes(file.type.toLowerCase())) {
    return 'Unsupported image format. Please use JPG, PNG, or WebP.';
  }

  return null; // Valid
}

/* ════════════════════════════════════════════════════════════════
   IMAGE PREVIEW
════════════════════════════════════════════════════════════════ */

function createImagePreview(file, previewElementId) {
  return new Promise((resolve, reject) => {
    const previewElement = document.getElementById(previewElementId);
    if (!previewElement) {
      reject(new Error(`Preview element with ID "${previewElementId}" not found`));
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      previewElement.src = e.target.result;
      previewElement.style.display = 'block';
      resolve(e.target.result);
    };
    reader.onerror = () => {
      reject(new Error('Failed to create image preview'));
    };
    reader.readAsDataURL(file);
  });
}

/* ════════════════════════════════════════════════════════════════
   CLOUDINARY UPLOAD
════════════════════════════════════════════════════════════════ */

async function uploadToCloudinary(fileOrBlob, progressWrapId = null, progressBarId = null) {
  // Validate configuration
  if (!cloudName || cloudName === 'YOUR_CLOUD_NAME') {
    throw new Error('Cloudinary Cloud Name not set. Go to Admin Panel → Settings.');
  }

  if (!uploadPreset) {
    throw new Error('Cloudinary Upload Preset not set. Go to Admin Panel → Settings.');
  }

  // Show progress elements
  const progressWrap = progressWrapId ? document.getElementById(progressWrapId) : null;
  const progressBar = progressBarId ? document.getElementById(progressBarId) : null;

  if (progressWrap) progressWrap.style.display = 'block';
  if (progressBar) progressBar.style.width = '0%';

  // Prepare upload data
  const formData = new FormData();
  formData.append('file', fileOrBlob);
  formData.append('upload_preset', uploadPreset);
  formData.append('folder', 'miskeen');

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    // Configure request
    xhr.open('POST', `https://api.cloudinary.com/v1_1/${encodeURIComponent(cloudName)}/image/upload`, true);

    // Progress tracking
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && progressBar) {
        const percent = Math.round((e.loaded / e.total) * 100);
        progressBar.style.width = percent + '%';
      }
    };

    // Success handler
    xhr.onload = () => {
      // Hide progress elements
      if (progressWrap) progressWrap.style.display = 'none';
      if (progressBar) progressBar.style.width = '0%';

      if (xhr.status === 200) {
        try {
          const response = JSON.parse(xhr.responseText);
          resolve(response.secure_url);
        } catch (error) {
          reject(new Error('Invalid response from Cloudinary'));
        }
      } else {
        let errorMessage = 'Upload failed';
        try {
          const errorResponse = JSON.parse(xhr.responseText);
          errorMessage = errorResponse.error?.message || errorMessage;
        } catch (_) {
          // Use default error message
        }
        reject(new Error(errorMessage));
      }
    };

    // Error handler
    xhr.onerror = () => {
      // Hide progress elements
      if (progressWrap) progressWrap.style.display = 'none';
      if (progressBar) progressBar.style.width = '0%';

      reject(new Error('Network error during upload. Check your connection.'));
    };

    // Send request
    xhr.send(formData);
  });
}

/* ════════════════════════════════════════════════════════════════
   BATCH IMAGE OPERATIONS
════════════════════════════════════════════════════════════════ */

async function uploadMultipleImages(files, onProgress = null, onComplete = null) {
  const results = [];
  const total = files.length;

  for (let i = 0; i < total; i++) {
    try {
      const file = files[i];
      const url = await uploadToCloudinary(file);

      results.push({
        success: true,
        file: file.name,
        url: url
      });

      // Progress callback
      if (onProgress) {
        onProgress({
          completed: i + 1,
          total: total,
          currentFile: file.name,
          url: url
        });
      }
    } catch (error) {
      results.push({
        success: false,
        file: files[i].name,
        error: error.message
      });
    }
  }

  // Complete callback
  if (onComplete) {
    const successful = results.filter(r => r.success).length;
    onComplete({
      total: total,
      successful: successful,
      failed: total - successful,
      results: results
    });
  }

  return results;
}

/* ════════════════════════════════════════════════════════════════
   IMAGE OPTIMIZATION UTILITIES
════════════════════════════════════════════════════════════════ */

function getOptimizedImageUrl(originalUrl, options = {}) {
  if (!originalUrl || !originalUrl.includes('cloudinary.com')) {
    return originalUrl;
  }

  const {
    width = null,
    height = null,
    quality = 80,
    format = 'auto'
  } = options;

  // Parse Cloudinary URL
  const urlParts = originalUrl.split('/upload/');
  if (urlParts.length !== 2) return originalUrl;

  // Build transformation string
  const transformations = [];

  if (width) transformations.push(`w_${width}`);
  if (height) transformations.push(`h_${height}`);
  if (quality) transformations.push(`q_${quality}`);
  if (format) transformations.push(`f_${format}`);

  // Add progressive loading and auto optimization
  transformations.push('fl_progressive', 'fl_lossy');

  const transformationString = transformations.join(',');

  return `${urlParts[0]}/upload/${transformationString}/${urlParts[1]}`;
}

function generateResponsiveImageSrcSet(originalUrl, breakpoints = [480, 768, 1024, 1200]) {
  if (!originalUrl || !originalUrl.includes('cloudinary.com')) {
    return originalUrl;
  }

  const srcSet = breakpoints.map(width =>
    `${getOptimizedImageUrl(originalUrl, { width })} ${width}w`
  ).join(', ');

  return srcSet;
}

/* ════════════════════════════════════════════════════════════════
   IMAGE MANAGEMENT HELPERS
════════════════════════════════════════════════════════════════ */

function cleanupImagePreview(previewElementId) {
  const previewElement = document.getElementById(previewElementId);
  if (previewElement) {
    previewElement.src = '';
    previewElement.style.display = 'none';
  }
}

function getImageDimensions(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve({
        width: img.naturalWidth,
        height: img.naturalHeight,
        aspectRatio: img.naturalWidth / img.naturalHeight
      });
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to get image dimensions'));
    };

    img.src = url;
  });
}

/* ════════════════════════════════════════════════════════════════
   EXPORTS
════════════════════════════════════════════════════════════════ */

export {
  initializeCloudinary,
  updateCloudinaryConfig,
  compressImage,
  validateImageFile,
  createImagePreview,
  uploadToCloudinary,
  uploadMultipleImages,
  getOptimizedImageUrl,
  generateResponsiveImageSrcSet,
  cleanupImagePreview,
  getImageDimensions
};