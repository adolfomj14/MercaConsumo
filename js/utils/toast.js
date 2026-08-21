// Notificaciones móviles y diálogos interactivos
export function showToast(message, type = 'info', duration = 3000) {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  
  let icon = 'ℹ️';
  if (type === 'success') icon = '✅';
  if (type === 'error') icon = '❌';
  if (type === 'warning') icon = '⚠️';

  toast.innerHTML = `<span>${icon}</span><span>${message}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(-10px)';
    toast.style.transition = 'all 0.25s ease';
    setTimeout(() => toast.remove(), 250);
  }, duration);
}

export function showConfirmDialog({ title, message, onConfirm, confirmText = 'Confirmar', isDanger = false }) {
  const modalContainer = document.getElementById('modal-container');
  if (!modalContainer) return;

  const modalHtml = `
    <div class="modal-backdrop show" id="confirm-modal-backdrop">
      <div class="modal-sheet" style="border-radius: 20px; margin-bottom: 20px;">
        <h3 style="font-size: 1.15rem; font-weight: 700; margin-bottom: 8px;">${title}</h3>
        <p style="color: var(--text-muted); font-size: 0.95rem; margin-bottom: 20px;">${message}</p>
        <div style="display: flex; gap: 10px;">
          <button class="btn btn-secondary" id="btn-confirm-cancel">Cancelar</button>
          <button class="btn ${isDanger ? 'btn-danger' : 'btn-primary'}" id="btn-confirm-ok">${confirmText}</button>
        </div>
      </div>
    </div>
  `;

  modalContainer.innerHTML = modalHtml;

  const backdrop = document.getElementById('confirm-modal-backdrop');
  const btnCancel = document.getElementById('btn-confirm-cancel');
  const btnOk = document.getElementById('btn-confirm-ok');

  const close = () => {
    modalContainer.innerHTML = '';
  };

  btnCancel.addEventListener('click', close);
  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) close();
  });

  btnOk.addEventListener('click', () => {
    close();
    if (onConfirm) onConfirm();
  });
}
