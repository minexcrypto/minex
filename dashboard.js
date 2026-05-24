/* ═══════════════════════════════════════════════════════════════
   CRYPTOVAULT — Deposit Form Functionality (Add to dashboard.js)
═══════════════════════════════════════════════════════════════ */

/* ─── DEPOSIT FORM INIT ───────────────────────────────────── */
function initDepositForm() {
  const form = $('depositSubmitForm');
  const coinSelect = $('depositCoin');
  const amountInput = $('depositAmount');
  const amountSuffix = $('amountSuffix');
  const amountHint = $('amountHint');
  const uploadArea = $('uploadArea');
  const fileInput = $('depositScreenshot');
  const uploadContent = $('uploadContent');
  const uploadPreview = $('uploadPreview');
  const previewImage = $('previewImage');
  const previewFilename = $('previewFilename');
  const removePreview = $('removePreview');

  if (!form) return;

  /* Coin select change → update suffix & hint */
  if (coinSelect) {
    coinSelect.addEventListener('change', () => {
      const val = coinSelect.value;
      if (val === 'usdt_bep20') {
        amountSuffix.textContent = 'USDT';
        amountHint.textContent = 'Minimum deposit: 10 USDT';
        amountInput.placeholder = '0.00';
        amountInput.step = '0.01';
        amountInput.min = '10';
      } else if (val === 'btc') {
        amountSuffix.textContent = 'BTC';
        amountHint.textContent = 'Minimum deposit: 0.0001 BTC';
        amountInput.placeholder = '0.00000000';
        amountInput.step = '0.00000001';
        amountInput.min = '0.0001';
      } else {
        amountSuffix.textContent = '—';
        amountHint.textContent = 'Enter the exact amount you sent';
      }
    });
  }

  /* File upload handling */
  if (uploadArea && fileInput) {
    // Click to upload
    uploadArea.addEventListener('click', (e) => {
      if (e.target.closest('.preview-remove')) return;
      fileInput.click();
    });

    // Drag & drop
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
      uploadArea.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
      });
    });

    ['dragenter', 'dragover'].forEach(eventName => {
      uploadArea.addEventListener(eventName, () => {
        uploadArea.classList.add('dragover');
      });
    });

    ['dragleave', 'drop'].forEach(eventName => {
      uploadArea.addEventListener(eventName, () => {
        uploadArea.classList.remove('dragover');
      });
    });

    uploadArea.addEventListener('drop', (e) => {
      const files = e.dataTransfer.files;
      if (files.length) handleFile(files[0]);
    });

    // File input change
    fileInput.addEventListener('change', () => {
      if (fileInput.files.length) handleFile(fileInput.files[0]);
    });

    function handleFile(file) {
      // Validate
      if (!file.type.startsWith('image/')) {
        Toast.show('❌ Please upload an image file (PNG, JPG, GIF)', 'error');
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        Toast.show('❌ File too large. Maximum size is 5MB.', 'error');
        return;
      }

      // Show preview
      const reader = new FileReader();
      reader.onload = (e) => {
        previewImage.src = e.target.result;
        previewFilename.textContent = file.name;
        uploadContent.style.display = 'none';
        uploadPreview.style.display = 'flex';
        uploadArea.classList.add('has-file');
        Toast.show('✅ Screenshot uploaded successfully', 'success');
      };
      reader.readAsDataURL(file);
    }

    // Remove preview
    if (removePreview) {
      removePreview.addEventListener('click', (e) => {
        e.stopPropagation();
        fileInput.value = '';
        previewImage.src = '';
        uploadContent.style.display = 'flex';
        uploadPreview.style.display = 'none';
        uploadArea.classList.remove('has-file');
      });
    }
  }

  /* Form submit */
  form.addEventListener('submit', (e) => {
    e.preventDefault();

    const coin = coinSelect?.value;
    const amount = amountInput?.value;
    const txHash = $('depositTxHash')?.value?.trim();
    const hasFile = fileInput?.files?.length > 0;

    // Validation
    if (!coin) {
      Toast.show('❌ Please select a coin', 'error');
      coinSelect?.focus();
      return;
    }
    if (!amount || parseFloat(amount) <= 0) {
      Toast.show('❌ Please enter a valid amount', 'error');
      amountInput?.focus();
      return;
    }
    if (!txHash) {
      Toast.show('❌ Please enter the transaction hash', 'error');
      $('depositTxHash')?.focus();
      return;
    }
    if (!hasFile) {
      Toast.show('❌ Please upload a screenshot as proof of payment', 'error');
      return;
    }

    // Show success (no backend)
    const coinLabel = coin === 'usdt_bep20' ? 'USDT (BEP20)' : 'BTC';
    Toast.show(`✅ Deposit request submitted!\n${amount} ${coinLabel} — Pending review`, 'success', 5000);

    // Reset form
    form.reset();
    if (removePreview) removePreview.click();
    amountSuffix.textContent = '—';
    amountHint.textContent = 'Enter the exact amount you sent';
  });
}

/* ─── INIT IN MAIN ────────────────────────────────────────── */
// Add this line inside the DOMContentLoaded callback in dashboard.js:
// initDepositForm();
