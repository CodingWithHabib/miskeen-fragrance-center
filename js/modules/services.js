/* ════════════════════════════════════════════════════════════════
   SERVICES MODULE — Business Logic & Data Processing
════════════════════════════════════════════════════════════════ */

import { VALID, SANITIZE, esc, generateStars, formatRelativeTime, formatCurrency, parseCurrency } from './utils.js';
import { getSettings, saveSettings, addProduct, updateProduct, deleteProduct, addReview, updateReview, deleteReview, updateStock, logOrder } from './firebase.js';
import { compressImage, validateImageFile, uploadToCloudinary } from './cloudinary.js';

/* ════════════════════════════════════════════════════════════════
   INITIALIZATION
════════════════════════════════════════════════════════════════ */

function initializeServices() {
  console.log('✅ Services module initialized');
}

/* ════════════════════════════════════════════════════════════════
   SETTINGS SERVICES
════════════════════════════════════════════════════════════════ */

async function loadApplicationSettings() {
  try {
    const settings = await getSettings();
    return {
      success: true,
      data: settings
    };
  } catch (error) {
    console.error('Error loading settings:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

async function updateApplicationSettings(settingsData) {
  try {
    // Validate settings
    const validation = validateSettingsData(settingsData);
    if (!validation.valid) {
      return {
        success: false,
        errors: validation.errors
      };
    }

    // Sanitize settings
    const sanitized = sanitizeSettingsData(settingsData);

    // Save to database
    const result = await saveSettings(sanitized);

    if (result.success) {
      return {
        success: true,
        message: 'Settings updated successfully'
      };
    } else {
      return {
        success: false,
        error: result.error
      };
    }
  } catch (error) {
    console.error('Error updating settings:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

function validateSettingsData(data) {
  const errors = [];

  // Validate WhatsApp number
  if (data.wa && VALID.whatsapp(data.wa)) {
    errors.push('Invalid WhatsApp number format');
  }

  // Validate phone number
  if (data.ph && VALID.phone(data.ph)) {
    errors.push('Invalid phone number format');
  }

  // Validate email
  if (data.em && VALID.email(data.em)) {
    errors.push('Invalid email address');
  }

  // Validate URLs
  if (data.ig && !isValidUrl(data.ig)) {
    errors.push('Invalid Instagram URL');
  }
  if (data.fb && !isValidUrl(data.fb)) {
    errors.push('Invalid Facebook URL');
  }

  return {
    valid: errors.length === 0,
    errors: errors
  };
}

function sanitizeSettingsData(data) {
  return {
    name: SANITIZE.text(data.name || ''),
    tag: SANITIZE.text(data.tag || ''),
    wa: SANITIZE.phone(data.wa || ''),
    ph: SANITIZE.phone(data.ph || ''),
    em: SANITIZE.text(data.em || ''),
    hr: SANITIZE.text(data.hr || ''),
    ig: SANITIZE.url(data.ig || ''),
    fb: SANITIZE.url(data.fb || ''),
    ftdesc: SANITIZE.text(data.ftdesc || ''),
    copy: SANITIZE.text(data.copy || ''),
    cloudName: SANITIZE.text(data.cloudName || ''),
    uploadPreset: SANITIZE.text(data.uploadPreset || ''),
    heroImgUrl: data.heroImgUrl || '',
    heroFeatName: SANITIZE.text(data.heroFeatName || '')
  };
}

function isValidUrl(string) {
  try {
    new URL(string);
    return true;
  } catch (_) {
    return false;
  }
}

/* ════════════════════════════════════════════════════════════════
   PRODUCT SERVICES
════════════════════════════════════════════════════════════════ */

async function createProduct(productData, imageFile = null) {
  try {
    // Validate product data
    const validation = validateProductData(productData);
    if (!validation.valid) {
      return {
        success: false,
        errors: validation.errors
      };
    }

    // Handle image upload if provided or use supplied image URL
    let imageUrl = productData.img || '';
    if (imageFile) {
      console.log('Processing uploaded image file:', imageFile.name);
      const imageValidation = validateImageFile(imageFile);
      if (imageValidation) {
        console.error('Image validation failed:', imageValidation);
        return {
          success: false,
          error: imageValidation
        };
      }

      try {
        const compressedImage = await compressImage(imageFile, 1000, 0.85);
        console.log('Image compressed, uploading to Cloudinary...');
        imageUrl = await uploadToCloudinary(compressedImage);
        console.log('Cloudinary upload successful, URL:', imageUrl);
      } catch (error) {
        console.error('Image upload failed:', error);
        return {
          success: false,
          error: `Image upload failed: ${error.message}`
        };
      }
    } else {
      console.log('No image file provided, using productData.img if set:', imageUrl);
    }

    // Sanitize and prepare product data
    const sanitizedData = sanitizeProductData({
      ...productData,
      img: imageUrl
    });

    // Save to database
    const result = await addProduct(sanitizedData);

    if (result.success) {
      return {
        success: true,
        message: 'Product created successfully',
        productId: result.id
      };
    } else {
      return {
        success: false,
        error: result.error
      };
    }
  } catch (error) {
    console.error('Error creating product:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

async function modifyProduct(productId, productData, imageFile = null) {
  try {
    // Validate product data
    const validation = validateProductData(productData);
    if (!validation.valid) {
      return {
        success: false,
        errors: validation.errors
      };
    }

    // Handle image upload if provided
    let imageUrl = productData.img || ''; // Keep existing image
    if (imageFile) {
      const imageValidation = validateImageFile(imageFile);
      if (imageValidation) {
        return {
          success: false,
          error: imageValidation
        };
      }

      try {
        const compressedImage = await compressImage(imageFile, 1000, 0.85);
        imageUrl = await uploadToCloudinary(compressedImage);
      } catch (error) {
        return {
          success: false,
          error: `Image upload failed: ${error.message}`
        };
      }
    }

    // Sanitize and prepare product data
    const sanitizedData = sanitizeProductData({
      ...productData,
      img: imageUrl
    });

    // Update in database
    const result = await updateProduct(productId, sanitizedData);

    if (result.success) {
      return {
        success: true,
        message: 'Product updated successfully'
      };
    } else {
      return {
        success: false,
        error: result.error
      };
    }
  } catch (error) {
    console.error('Error updating product:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

async function removeProduct(productId, productName) {
  try {
    const result = await deleteProduct(productId);

    if (result.success) {
      return {
        success: true,
        message: `Product "${productName}" deleted successfully`
      };
    } else {
      return {
        success: false,
        error: result.error
      };
    }
  } catch (error) {
    console.error('Error deleting product:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

function validateProductData(data) {
  const errors = [];

  // Required fields
  if (VALID.required(data.name, 'Product name')) {
    errors.push('Product name is required');
  }

  if (VALID.required(data.desc, 'Description')) {
    errors.push('Description is required');
  }

  if (!data.cat) {
    errors.push('Category is required');
  }

  // Field validations
  if (data.name && VALID.minLength(data.name, 2, 'Product name')) {
    errors.push('Product name must be at least 2 characters');
  }

  if (data.name && VALID.maxLength(data.name, 100, 'Product name')) {
    errors.push('Product name must be no more than 100 characters');
  }

  if (data.desc && VALID.minLength(data.desc, 10, 'Description')) {
    errors.push('Description must be at least 10 characters');
  }

  if (data.desc && VALID.maxLength(data.desc, 500, 'Description')) {
    errors.push('Description must be no more than 500 characters');
  }

  // Category validation
  if (data.cat && VALID.category(data.cat)) {
    errors.push('Invalid category selected');
  }

  return {
    valid: errors.length === 0,
    errors: errors
  };
}

function sanitizeProductData(data) {
  return {
    name: SANITIZE.text(data.name || ''),
    cat: SANITIZE.text(data.cat || ''),
    desc: SANITIZE.text(data.desc || ''),
    badge: SANITIZE.text(data.badge || ''),
    img: data.img || '',
    featured: Boolean(data.featured),
    sizes: Array.isArray(data.sizes) ? data.sizes.map(size => ({
      ml: SANITIZE.text(size.ml || ''),
      price: SANITIZE.price(size.price || '')
    })) : []
  };
}

/* ════════════════════════════════════════════════════════════════
   REVIEW SERVICES
════════════════════════════════════════════════════════════════ */

async function submitProductReview(reviewData) {
  try {
    // Validate review data
    const validation = validateReviewData(reviewData);
    if (!validation.valid) {
      return {
        success: false,
        errors: validation.errors
      };
    }

    // Sanitize review data
    const sanitizedData = sanitizeReviewData(reviewData);
    
    console.log("Sanitized Review:", sanitizedData);
    // Save to database
    const result = await addReview(sanitizedData);

    if (result.success) {
      return {
        success: true,
        message: 'Thank you for your review! It will be published after approval.',
        reviewId: result.id
      };
    } else {
      return {
        success: false,
        error: result.error
      };
    }
  } catch (error) {
    console.error('Error submitting review:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

async function removeReview(reviewId) {
  try {
    const result = await deleteReview(reviewId);

    if (result.success) {
      return {
        success: true,
        message: 'Review deleted successfully'
      };
    } else {
      return {
        success: false,
        error: result.error
      };
    }
  } catch (error) {
    console.error('Error deleting review:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

function validateReviewData(data) {
  const errors = [];

  // Required fields
  if (VALID.required(data.name, 'Your name')) {
    errors.push('Name is required');
  }

  if (VALID.required(data.comment, 'Review text')) {
    errors.push('Review text is required');
  }

  // Field validations
  if (data.name && VALID.minLength(data.name, 2, 'Name')) {
    errors.push('Name must be at least 2 characters');
  }

  if (data.name && VALID.maxLength(data.name, 50, 'Name')) {
    errors.push('Name must be no more than 50 characters');
  }

  if (data.comment && VALID.minLength(data.comment, 10, 'Review')) {
    errors.push('Review must be at least 10 characters');
  }

  if (data.comment && VALID.maxLength(data.comment, 500, 'Review')) {
    errors.push('Review must be no more than 500 characters');
  }

  if (data.city && VALID.maxLength(data.city, 50, 'City')) {
    errors.push('City name must be no more than 50 characters');
  }

  // Rating validation
  if (VALID.rating(data.rating)) {
    errors.push('Please select a rating between 1 and 5 stars');
  }

  return {
    valid: errors.length === 0,
    errors: errors
  };
}

function sanitizeReviewData(data) {
  return {
    name: SANITIZE.text(data.name || ''),
    city: SANITIZE.text(data.city || ''),
    product: SANITIZE.text(data.product || ''),
    rating: parseInt(data.rating) || 5,
    comment: SANITIZE.text(data.comment || '')
  };
}

/* ════════════════════════════════════════════════════════════════
   ORDER SERVICES
════════════════════════════════════════════════════════════════ */

async function processWhatsAppOrder(orderData) {
  try {
    // Validate order data
    const validation = validateOrderData(orderData);
    if (!validation.valid) {
      return {
        success: false,
        errors: validation.errors
      };
    }

    // Log order to database
    const result = await logOrder(orderData);

    if (result.success) {
      return {
        success: true,
        message: 'Order processed successfully'
      };
    } else {
      return {
        success: false,
        error: result.error
      };
    }
  } catch (error) {
    console.error('Error processing order:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

function validateOrderData(data) {
  const errors = [];

  // Required fields
  if (!data.product) {
    errors.push('Product name is required');
  }

  if (!data.size) {
    errors.push('Size selection is required');
  }

  if (!data.total) {
    errors.push('Total price is required');
  }

  return {
    valid: errors.length === 0,
    errors: errors
  };
}

/* ════════════════════════════════════════════════════════════════
   STOCK MANAGEMENT SERVICES
════════════════════════════════════════════════════════════════ */

async function updateProductStock(productId, newStock) {
  try {
    const stockValue = parseInt(newStock);
    if (isNaN(stockValue) || stockValue < 0) {
      return {
        success: false,
        error: 'Stock must be a valid non-negative number'
      };
    }

    const result = await updateStock(productId, stockValue);

    if (result.success) {
      return {
        success: true,
        message: `Stock updated to ${stockValue}`
      };
    } else {
      return {
        success: false,
        error: result.error
      };
    }
  } catch (error) {
    console.error('Error updating stock:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/* ════════════════════════════════════════════════════════════════
   DATA TRANSFORMATION HELPERS
════════════════════════════════════════════════════════════════ */

function formatProductForDisplay(product) {
  const formatted = {
    ...product,
    displayName: esc(product.name),
    displayDesc: esc(product.desc),
    displayCat: esc(product.cat).toUpperCase(),
    displayBadge: esc(product.badge),
    displayPrice: product.sizes && product.sizes.length > 0
      ? formatCurrency(parseCurrency(product.sizes[0].price))
      : 'Price not available',
    hasImage: Boolean(product.img),
    imageUrl: product.img || '',
    isFeatured: Boolean(product.featured),
    sizes: product.sizes || []
  };
  console.log('Formatted product for display:', { name: product.name, img: product.img, hasImage: formatted.hasImage, imageUrl: formatted.imageUrl });
  return formatted;
}

function formatReviewForDisplay(review) {
  return {
    ...review,
    displayName: review.name || '',
    displayCity: review.city || '',
    displayText: review.text || review.comment || '',
    displayProduct: review.product || '',
    stars: generateStars(review.rating),
    relativeTime: formatRelativeTime(review.createdAt?.toDate?.() || new Date()),
    isApproved: Boolean(review.approved)
  };
}

function generateWhatsAppOrderMessage(orderData) {
  const { product, size, quantity, total, customerName, customerPhone } = orderData;

  return `🛍️ *NEW ORDER - ${esc(product)}*

👤 *Customer:* ${esc(customerName || 'Not provided')}
📞 *Phone:* ${esc(customerPhone || 'Not provided')}

📦 *Product:* ${esc(product)}
📏 *Size:* ${esc(size)}
🔢 *Quantity:* ${quantity || 1}
💰 *Total:* ${esc(total)}

Thank you for your order! We'll contact you shortly to confirm details and arrange payment/delivery.

*Miskeen Fragrance Center*
Pure • Natural • Halal • Delivered Nationwide`;
}

/* ════════════════════════════════════════════════════════════════
   EXPORTS
════════════════════════════════════════════════════════════════ */

export {
  initializeServices,
  loadApplicationSettings,
  updateApplicationSettings,
  createProduct,
  modifyProduct,
  removeProduct,
  submitProductReview,
  removeReview,
  processWhatsAppOrder,
  updateProductStock,
  formatProductForDisplay,
  formatReviewForDisplay,
  generateWhatsAppOrderMessage
};