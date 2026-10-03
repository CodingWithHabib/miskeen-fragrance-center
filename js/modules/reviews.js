/* ════════════════════════════════════════════════════════════════
   REVIEWS MODULE — Review Display & Management
════════════════════════════════════════════════════════════════ */

import { STORE, reviews, showToast } from '../config.js';
import { esc, generateStars, formatRelativeTime, storage } from './utils.js';
import { submitProductReview, removeReview, formatReviewForDisplay } from './services.js';
import { updateReview } from './firebase.js';

const REVIEW_COOLDOWN_MS = 60_000;
let lastReviewSubmissionTime = 0;

/* ════════════════════════════════════════════════════════════════
   INITIALIZATION
════════════════════════════════════════════════════════════════ */

function initializeReviews() {
  setupReviewFormHandlers();
  const saved = storage.get('lastReviewTime', 0);
  if (saved) lastReviewSubmissionTime = saved;
  renderAllReviews(reviews);
  console.log('✅ Reviews module initialized');
}

function setupReviewFormHandlers() {
  // Event handler is already attached via onclick="app.submitReview()" in HTML
  // No need to add duplicate event listener here

  const textArea = document.getElementById('rv-text');
  if (textArea) {
    textArea.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && e.ctrlKey) handleReviewSubmission();
    });
  }
}

/* ════════════════════════════════════════════════════════════════
   REVIEW RENDERING
════════════════════════════════════════════════════════════════ */

function renderReviewCard(review) {
  const formatted = formatReviewForDisplay(review);
  return `<div class="rcard">
    <p class="rcard-text">"${esc(formatted.displayText)}"</p>
    <div class="rcard-foot">
      <div class="rcard-avatar">👤</div>
      <div>
        <div class="rcard-name">${esc(formatted.displayName)}${formatted.displayCity ? `, ${esc(formatted.displayCity)}` : ''}</div>
        <div class="rcard-stars">${generateStars(formatted.isApproved ? review.rating || 5 : 3)}</div>
        ${formatted.displayProduct ? `<div style="font-size:.62rem;color:var(--muted);margin-top:.15rem;">${esc(formatted.displayProduct)}</div>` : ''}
      </div>
    </div>
  </div>`;
}

function renderAllReviews(reviewsList) {
  const container = document.getElementById('reviews-grid');
  if (!container) return;

  const approved = reviewsList.filter(r => r.approved !== false);
  container.innerHTML = approved.length
    ? approved.map(renderReviewCard).join('')
    : `<div class="empty-state" style="grid-column:1/-1;"><span class="empty-icon">⭐</span><h3>No Reviews Yet</h3><p>Be the first to share your experience with our fragrances!</p></div>`;
}

/* ════════════════════════════════════════════════════════════════
   REVIEW SUBMISSION
════════════════════════════════════════════════════════════════ */

async function handleReviewSubmission() {
  try {
    const timeSince = Date.now() - lastReviewSubmissionTime;
    if (timeSince < REVIEW_COOLDOWN_MS) {
      showReviewCooldownMessage(Math.ceil((REVIEW_COOLDOWN_MS - timeSince) / 1000));
      return;
    }

    const reviewData = {
      name:   (document.getElementById('rv-name')?.value   || '').trim(),
      city:   (document.getElementById('rv-city')?.value   || '').trim(),
      product:(document.getElementById('rv-product')?.value || ''),
      rating: parseInt(document.getElementById('rv-rating')?.value || 5),
      text:   (document.getElementById('rv-text')?.value   || '').trim(),
    };

    const submitBtn = document.getElementById('rv-submit-btn');
    if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'SUBMITTING...'; }

    const result = await submitProductReview(reviewData);

    if (result.success) {
      document.getElementById('rv-name').value    = '';
      document.getElementById('rv-city').value    = '';
      document.getElementById('rv-product').value = '';
      document.getElementById('rv-rating').value  = 5;
      document.getElementById('rv-text').value    = '';

      lastReviewSubmissionTime = Date.now();
      storage.set('lastReviewTime', lastReviewSubmissionTime);

      const successMsg = document.getElementById('review-success');
      if (successMsg) { successMsg.style.display = 'block'; setTimeout(() => { successMsg.style.display = 'none'; }, 5000); }

      showToast(result.message, 'success');

      if (submitBtn) {
        submitBtn.disabled = true;
        let remaining = Math.ceil(REVIEW_COOLDOWN_MS / 1000);
        const timer = setInterval(() => {
          remaining--;
          if (submitBtn) submitBtn.textContent = `SUBMIT REVIEW (${remaining}s)`;
          if (remaining <= 0) { clearInterval(timer); if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'SUBMIT REVIEW'; } }
        }, 1000);
      }
    } else {
      showToast(result.errors ? result.errors.join(', ') : result.error || 'Failed to submit review', 'error');
      // Reset button on failure
      if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'SUBMIT REVIEW'; }
    }
  } catch (error) {
    console.error('Error submitting review:', error);
    showToast('An error occurred while submitting your review', 'error');
    // Reset button on error
    const submitBtn = document.getElementById('rv-submit-btn');
    if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'SUBMIT REVIEW'; }
  }
}

function showReviewCooldownMessage(remainingSeconds) {
  const el = document.querySelector('.review-cooldown');
  if (el) {
    el.style.display = 'block';
    el.textContent = `⏳ You can submit another review in ${remainingSeconds} seconds`;
    setTimeout(() => { el.style.display = 'none'; }, (remainingSeconds + 1) * 1000);
  }
  showToast(`Please wait ${remainingSeconds} seconds before submitting another review`, 'warn');
}

/* ════════════════════════════════════════════════════════════════
   ADMIN REVIEW MANAGEMENT
════════════════════════════════════════════════════════════════ */

function renderAdminReviewsList(adminReviews) {
  const container = document.getElementById('adm-review-list');
  if (!container) return;

  container.innerHTML = adminReviews && adminReviews.length
    ? adminReviews.map(review => `
      <div class="adm-item">
        <div class="adm-item-info" style="flex:1;">
          <div class="adm-item-name">
            ${esc(review.name)}${review.city ? ` — ${esc(review.city)}` : ''}
            <span style="color:var(--gold2);font-size:.7rem;margin-left:.5rem;">${generateStars(review.rating || 5)}</span>
            ${review.approved ? '<span style="font-size:.6rem;color:#4caf50;margin-left:.5rem;">✓ Approved</span>' : '<span style="font-size:.6rem;color:#ff9800;margin-left:.5rem;">⏳ Pending</span>'}
          </div>
          <div class="adm-item-meta" style="white-space:normal;margin-top:.3rem;">${esc(review.text)}</div>
          ${review.product ? `<div style="font-size:.6rem;color:rgba(245,239,230,.3);margin-top:.2rem;">Product: ${esc(review.product)}</div>` : ''}
          <div style="font-size:.6rem;color:rgba(245,239,230,.3);margin-top:.2rem;">Submitted: ${formatRelativeTime(review.createdAt?.toDate?.() || new Date())}</div>
        </div>
        <div style="display:flex;flex-direction:column;gap:.5rem;flex-shrink:0;">
          ${!review.approved ? `<button class="btn btn-gold" onclick="app.approveReview('${esc(review.id)}')" style="font-size:.55rem;">✓ APPROVE</button>` : ''}
          <button class="btn-danger" onclick="app.deleteReview('${esc(review.id)}')" style="font-size:.55rem;">🗑 DELETE</button>
        </div>
      </div>`).join('')
    : `<div class="empty-state"><span class="empty-icon">⭐</span><h3>No Reviews</h3><p>No customer reviews yet.</p></div>`;
}

async function deleteReview(reviewId) {
  try {
    if (!confirm('Are you sure you want to delete this review?')) return;
    const result = await removeReview(reviewId);
    if (result.success) {
      showToast(result.message, 'success');
      renderAdminReviewsList(window.firebaseReviews || []);
    } else {
      showToast(result.error || 'Failed to delete review', 'error');
    }
  } catch (error) {
    console.error('Error deleting review:', error);
    showToast('An error occurred while deleting the review', 'error');
  }
}

// FIX: actually approve the review in Firestore instead of just logging
async function approveReview(reviewId) {
  try {
    const result = await updateReview(reviewId, { approved: true });
    if (result.success) {
      showToast('Review approved and published!', 'success');
      // Update local cache and re-render
      const reviews = window.firebaseReviews || [];
      const review  = reviews.find(r => r.id === reviewId);
      if (review) review.approved = true;
      renderAdminReviewsList(reviews);
    } else {
      showToast(result.error || 'Failed to approve review', 'error');
    }
  } catch (error) {
    console.error('Error approving review:', error);
    showToast('An error occurred while approving the review', 'error');
  }
}

function getRemainingCooldownTime() {
  return Math.max(0, REVIEW_COOLDOWN_MS - (Date.now() - lastReviewSubmissionTime));
}

function canSubmitReview() { return getRemainingCooldownTime() <= 0; }

export {
  initializeReviews, renderAllReviews, renderAdminReviewsList,
  handleReviewSubmission, deleteReview, approveReview,
  getRemainingCooldownTime, canSubmitReview
};
