// Modal reutilizable para Crear/Editar un Perfil Familiar (avatar emoji o foto real)
import {
  createFamilyProfile, updateFamilyProfile, deleteFamilyProfile,
  uploadProfileAvatar, AVATAR_EMOJIS
} from '../services/profiles.js';
import { showToast, showConfirmDialog } from '../utils/toast.js';

// existing: registro de family_profiles a editar, o null para crear uno nuevo.
// onSaved(profileRecord): callback tras guardar con éxito.
// onDeleted(): callback tras eliminar con éxito.
export function openProfileEditorModal({ existing = null, onSaved, onDeleted } = {}) {
  const mc = document.getElementById('modal-container');
  if (!mc) return;

  let selectedEmoji = (existing?.avatar_type === 'emoji' && existing.avatar_value) ? existing.avatar_value : AVATAR_EMOJIS[0];
  let selectedPhotoFile = null;
  let photoPreviewUrl = existing?.avatar_type === 'photo' ? existing.avatar_value : null;

  mc.innerHTML = `
    <div class="modal-backdrop show" id="profile-modal-backdrop">
      <div class="modal-sheet">
        <div class="modal-header">
          <h2 style="font-size:1.1rem; font-weight:800; margin:0;">${existing ? 'Editar Perfil' : 'Nuevo Perfil Familiar'}</h2>
          <button class="btn btn-secondary btn-sm" id="btn-close-profile-modal" style="border:none; padding:4px 8px;">✕</button>
        </div>

        <div class="form-group">
          <label class="form-label">Nombre</label>
          <input type="text" id="inp-profile-name" class="form-input" placeholder="Ej: Mamá, Juan..." value="${existing?.name || ''}" maxlength="20">
        </div>

        <div class="form-group">
          <label class="form-label">Foto de perfil</label>
          <div style="display:flex; align-items:center; gap:12px; margin-bottom:10px;">
            <div id="photo-preview" style="width:56px; height:56px; border-radius:14px; overflow:hidden; background:var(--bg-main); display:flex; align-items:center; justify-content:center; font-size:1.6rem; flex-shrink:0;">
              ${photoPreviewUrl ? `<img src="${photoPreviewUrl}" style="width:100%; height:100%; object-fit:cover;">` : selectedEmoji}
            </div>
            <label class="btn btn-secondary btn-sm" style="cursor:pointer; margin:0;">
              📷 Subir Foto
              <input type="file" id="inp-profile-photo" accept="image/*" style="display:none;">
            </label>
          </div>
          <label class="form-label" style="font-size:0.78rem;">O elige un ícono:</label>
          <div id="emoji-picker" style="display:flex; flex-wrap:wrap; gap:6px; margin-top:6px;">
            ${AVATAR_EMOJIS.map(e => `
              <button type="button" class="emoji-opt" data-emoji="${e}"
                      style="width:36px; height:36px; border-radius:10px; border:2px solid ${e === selectedEmoji && !photoPreviewUrl ? 'var(--primary)' : 'var(--border)'}; background:var(--bg-main); font-size:1.1rem; cursor:pointer;">${e}</button>
            `).join('')}
          </div>
        </div>

        <div style="display:flex; gap:8px; margin-top:16px;">
          ${existing && !existing.is_owner ? `<button type="button" class="btn btn-secondary" id="btn-delete-profile" style="color:var(--danger); border-color:#fecaca;">Eliminar</button>` : ''}
          <button type="button" class="btn btn-primary" id="btn-save-profile" style="flex:1;">Guardar</button>
        </div>
      </div>
    </div>
  `;

  const close = () => { mc.innerHTML = ''; };
  document.getElementById('btn-close-profile-modal')?.addEventListener('click', close);
  document.getElementById('profile-modal-backdrop')?.addEventListener('click', e => {
    if (e.target.id === 'profile-modal-backdrop') close();
  });

  document.querySelectorAll('.emoji-opt').forEach(btn => {
    btn.addEventListener('click', () => {
      selectedEmoji = btn.getAttribute('data-emoji');
      selectedPhotoFile = null;
      photoPreviewUrl = null;
      document.getElementById('photo-preview').innerHTML = selectedEmoji;
      document.querySelectorAll('.emoji-opt').forEach(b => { b.style.border = '2px solid var(--border)'; });
      btn.style.border = '2px solid var(--primary)';
    });
  });

  document.getElementById('inp-profile-photo')?.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    selectedPhotoFile = file;
    const reader = new FileReader();
    reader.onload = (ev) => {
      photoPreviewUrl = ev.target.result;
      document.getElementById('photo-preview').innerHTML = `<img src="${photoPreviewUrl}" style="width:100%; height:100%; object-fit:cover;">`;
    };
    reader.readAsDataURL(file);
  });

  document.getElementById('btn-delete-profile')?.addEventListener('click', () => {
    showConfirmDialog({
      title: 'Eliminar Perfil',
      message: `¿Seguro que quieres eliminar el perfil de "${existing.name}"?`,
      isDanger: true,
      confirmText: 'Eliminar',
      onConfirm: async () => {
        try {
          await deleteFamilyProfile(existing.id);
          showToast('Perfil eliminado', 'success');
          close();
          if (onDeleted) onDeleted();
        } catch (err) {
          showToast(err.message, 'error');
        }
      }
    });
  });

  document.getElementById('btn-save-profile')?.addEventListener('click', async () => {
    const name = document.getElementById('inp-profile-name').value.trim();
    if (!name) { showToast('Ponle un nombre al perfil', 'warning'); return; }

    const btn = document.getElementById('btn-save-profile');
    btn.disabled = true;
    btn.textContent = 'Guardando...';

    try {
      let profileRecord;
      if (existing) {
        profileRecord = await updateFamilyProfile({ id: existing.id, name });
      } else {
        profileRecord = await createFamilyProfile({ name, avatarType: 'emoji', avatarValue: selectedEmoji });
      }

      if (selectedPhotoFile) {
        const url = await uploadProfileAvatar(selectedPhotoFile, profileRecord.id);
        profileRecord = await updateFamilyProfile({ id: profileRecord.id, avatarType: 'photo', avatarValue: url });
      } else if (existing && !photoPreviewUrl && existing.avatar_type === 'photo') {
        // El usuario quitó la foto y volvió a un emoji
        profileRecord = await updateFamilyProfile({ id: profileRecord.id, avatarType: 'emoji', avatarValue: selectedEmoji });
      }

      showToast(existing ? 'Perfil actualizado ✅' : 'Perfil creado ✅', 'success');
      close();
      if (onSaved) onSaved(profileRecord);
    } catch (err) {
      btn.disabled = false;
      btn.textContent = 'Guardar';
      showToast(err.message, 'error');
    }
  });
}
