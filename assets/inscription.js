const formState = {
  step: 1,
  data: null,
  paymentMethods: [],
  ticketTypes: [],
  purchasedTicket: null,
  qrDownloadBlob: null,
  existingPlayers: [],
};

function getConfig() {
  return window.TOGW_INSCRIPTION_CONFIG;
}

function getDisplayAmount(ancienParticipant) {
  const ticketType = resolveTicketType(ancienParticipant, { throwOnMissing: false });
  if (ticketType) return Number(ticketType.price);
  const config = getConfig();
  return ancienParticipant ? config.PRICE_RETURNING : config.PRICE_NEW;
}

function resolveTicketType(ancienParticipant, options = { throwOnMissing: true }) {
  const config = getConfig();
  const targetId =
    ancienParticipant && config.TICKET_TYPE_ID_RETURNING
      ? config.TICKET_TYPE_ID_RETURNING
      : config.TICKET_TYPE_ID;

  const ticketType = formState.ticketTypes.find((type) => String(type.id) === String(targetId));
  if (!ticketType && options.throwOnMissing) {
    const available = formState.ticketTypes
      .map((type) => `${type.name} (id ${type.id}, ${formatPrix(type.price)})`)
      .join(', ');
    throw new Error(
      available
        ? `Le billet « ${config.TICKET_TYPE_NAME} » (id ${targetId}) est introuvable ou inactif dans ToliarEvent. Billets actifs : ${available}.`
        : `Le billet « ${config.TICKET_TYPE_NAME} » (id ${targetId}) est introuvable ou inactif dans ToliarEvent.`
    );
  }
  return ticketType || null;
}

function getSupabaseErrorMessage() {
  const status = window.TOGW_SUPABASE_STATUS;
  if (status?.reason === 'missing_key' || status?.reason === 'missing_config') {
    return 'Configuration Supabase incomplète : ajoutez votre clé anon dans assets/supabase-config.js (Supabase → Project Settings → API → anon public).';
  }
  if (window.location.protocol === 'file:') {
    return 'Ouvrez le site via un serveur local (npm run dev) au lieu d’ouvrir le fichier HTML directement.';
  }
  if (status?.reason === 'sdk_missing') {
    return 'Le SDK Supabase n’a pas pu se charger. Vérifiez votre connexion internet.';
  }
  return 'Connexion Supabase indisponible. Vérifiez assets/supabase-config.js.';
}

function ensureSupabaseReady() {
  if (!window.togwSupabase) {
    throw new Error(getSupabaseErrorMessage());
  }
}

function showSetupWarnings() {
  const banner = document.getElementById('setupWarning');
  if (!banner) return;

  const warnings = [];
  if (window.location.protocol === 'file:') {
    warnings.push(
      'Ce site doit être ouvert via un serveur local. Dans le dossier du projet, lancez <code class="text-primary">npm run dev</code> puis ouvrez <code class="text-primary">http://localhost:5500/pages/inscription.html</code>.'
    );
  }
  if (!window.togwSupabase) {
    warnings.push(getSupabaseErrorMessage());
  }

  if (!warnings.length) {
    banner.classList.add('hidden');
    banner.innerHTML = '';
    return;
  }

  banner.classList.remove('hidden');
  banner.innerHTML = warnings.map((warning) => `<p class="mb-2 last:mb-0">${warning}</p>`).join('');
}

function formatPrix(amount) {
  return `${Number(amount).toLocaleString('fr-FR')} Ar`;
}

function showPanel(id) {
  ['step1Panel', 'step2Panel', 'successMessage', 'adminSuccessMessage', 'duplicateMessage', 'errorMessage'].forEach((panelId) => {
    const el = document.getElementById(panelId);
    if (el) el.classList.add('hidden');
  });
  document.getElementById(id)?.classList.remove('hidden');
}

function isAdminMode() {
  return Boolean(window.TOGWAuth?.isAdmin());
}

function applyTogwAdminInscriptionUi(isAdmin = isAdminMode()) {
  const step2 = document.getElementById('stepIndicatorStep2');
  const divider = document.getElementById('stepIndicatorDivider');
  const submitText = document.getElementById('btnStep1SubmitText');
  const submitIcon = document.getElementById('btnStep1SubmitIcon');
  const heroSubtitle = document.getElementById('inscriptionHeroSubtitle');

  step2?.classList.toggle('hidden', isAdmin);
  divider?.classList.toggle('hidden', isAdmin);

  if (submitText) {
    submitText.textContent = isAdmin ? 'INSCRIRE LE JOUEUR' : 'CONTINUER VERS LE PAIEMENT';
  }
  if (submitIcon) {
    submitIcon.textContent = isAdmin ? 'person_add' : 'arrow_forward';
  }
  if (heroSubtitle) {
    heroSubtitle.textContent = isAdmin
      ? 'Mode organisateur : inscrivez un joueur directement. Le paiement se fera sur place le jour du tournoi.'
      : 'Inscrivez-vous maintenant pour participer au Matchranking #2 du 25 Juillet 2026 et faire vos preuves !';
  }
}

window.applyTogwAdminInscriptionUi = applyTogwAdminInscriptionUi;

function updateStepIndicator(step) {
  document.querySelectorAll('[data-step-item]').forEach((item) => {
    const itemStep = Number(item.dataset.stepItem);
    const isActive = itemStep === step;
    const isDone = itemStep < step;
    item.classList.toggle('text-primary', isActive || isDone);
    item.classList.toggle('text-on-surface-variant', !isActive && !isDone);
    item.querySelector('.step-dot')?.classList.toggle('bg-primary', isActive || isDone);
    item.querySelector('.step-dot')?.classList.toggle('bg-outline-variant', !isActive && !isDone);
  });
}

function isReturningParticipantMode() {
  return document.getElementById('ancien_participant')?.checked === true;
}

function getSelectedExistingPlayer() {
  const playerId = formState.data?.existing_player_id;
  if (!playerId) return null;
  return formState.existingPlayers.find((player) => player.id === playerId) || null;
}

async function loadExistingPlayers() {
  if (!window.togwSupabase) return;

  const select = document.getElementById('existingPlayerSelect');
  if (select) {
    select.innerHTML = '<option value="">Chargement des joueurs...</option>';
  }

  const { data, error } = await window.togwSupabase
    .from('players')
    .select('id, name')
    .order('name', { ascending: true });

  if (error) throw error;

  formState.existingPlayers = data || [];
  renderExistingPlayerOptions();
}

function renderExistingPlayerOptions() {
  const select = document.getElementById('existingPlayerSelect');
  if (!select) return;

  if (!formState.existingPlayers.length) {
    select.innerHTML = '<option value="">Aucun joueur trouvé</option>';
    return;
  }

  select.innerHTML = [
    '<option value="">Sélectionnez votre pseudo</option>',
    ...formState.existingPlayers.map(
      (player) => `<option value="${player.id}">${player.name}</option>`
    ),
  ].join('');
}

function setFieldsDisabled(container, disabled) {
  if (!container) return;
  container.querySelectorAll('input, select, textarea, button').forEach((field) => {
    if (field.id === 'ancien_participant') return;
    field.disabled = disabled;
  });
}

function updateReturningParticipantUi() {
  const returning = isReturningParticipantMode();
  const newFields = document.getElementById('newParticipantFields');
  const conditions = document.getElementById('conditionsSection');
  const existingBlock = document.getElementById('existingPlayerBlock');
  const existingSelect = document.getElementById('existingPlayerSelect');

  if (existingBlock) {
    existingBlock.classList.toggle('hidden', !returning);
  }

  setFieldsDisabled(newFields, returning);
  setFieldsDisabled(conditions, returning);

  if (existingSelect) {
    existingSelect.disabled = !returning;
    existingSelect.required = returning;
    if (!returning) existingSelect.value = '';
  }

  conditions?.querySelectorAll('input[type="checkbox"][required]').forEach((checkbox) => {
    checkbox.required = !returning;
  });

  newFields?.querySelectorAll('input[required]').forEach((input) => {
    input.required = !returning;
  });
}

function collectStep1Data(form) {
  const formData = new FormData(form);
  const avatarInput = form.querySelector('#avatarInput');
  const avatarFile = avatarInput?.files?.[0] || null;
  const returning = formData.get('ancien_participant') === 'on';

  return {
    nom: formData.get('nom')?.trim() || '',
    prenom: formData.get('prenom')?.trim() || '',
    pseudo: formData.get('pseudo')?.trim() || '',
    adresse: formData.get('adresse')?.trim() || '',
    telephone: formData.get('telephone')?.trim() || '',
    email: formData.get('email')?.trim() || '',
    ancien_participant: returning,
    existing_player_id: returning ? formData.get('existing_player_id') || '' : '',
    avatarFile: returning ? null : avatarFile,
  };
}

function validateAvatarFile(file) {
  if (!file) return;

  const config = getConfig();
  const maxBytes = (config.AVATAR_MAX_SIZE_MB || 2) * 1024 * 1024;
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

  if (!allowedTypes.includes(file.type)) {
    throw new Error('Format d’image non supporté. Utilisez JPG, PNG, WebP ou GIF.');
  }
  if (file.size > maxBytes) {
    throw new Error(`L’image ne doit pas dépasser ${config.AVATAR_MAX_SIZE_MB || 2} Mo.`);
  }
}

function showAvatarError(message) {
  const errorEl = document.getElementById('avatarError');
  if (!errorEl) return;
  if (!message) {
    errorEl.classList.add('hidden');
    errorEl.textContent = '';
    return;
  }
  errorEl.textContent = message;
  errorEl.classList.remove('hidden');
}

function resetAvatarField() {
  const input = document.getElementById('avatarInput');
  const preview = document.getElementById('avatarPreview');
  const previewImage = document.getElementById('avatarPreviewImage');
  const clearBtn = document.getElementById('btnClearAvatar');

  if (input) input.value = '';
  if (previewImage) previewImage.removeAttribute('src');
  preview?.classList.add('hidden');
  clearBtn?.classList.add('hidden');
  showAvatarError('');
}

function setupAvatarField() {
  const input = document.getElementById('avatarInput');
  const preview = document.getElementById('avatarPreview');
  const previewImage = document.getElementById('avatarPreviewImage');
  const clearBtn = document.getElementById('btnClearAvatar');

  input?.addEventListener('change', () => {
    const file = input.files?.[0];
    if (!file) {
      resetAvatarField();
      return;
    }

    try {
      validateAvatarFile(file);
      const objectUrl = URL.createObjectURL(file);
      if (previewImage) previewImage.src = objectUrl;
      preview?.classList.remove('hidden');
      clearBtn?.classList.remove('hidden');
    } catch (err) {
      resetAvatarField();
      showAvatarError(err.message);
    }
  });

  clearBtn?.addEventListener('click', resetAvatarField);
}

function getAvatarExtension(file) {
  const fromName = file.name?.split('.').pop()?.toLowerCase();
  if (fromName && ['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(fromName)) {
    return fromName === 'jpeg' ? 'jpg' : fromName;
  }

  const map = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/gif': 'gif',
  };
  return map[file.type] || 'jpg';
}

async function uploadPlayerAvatar(file) {
  ensureSupabaseReady();
  validateAvatarFile(file);

  const bucket = getConfig().AVATAR_BUCKET || 'profil';
  const extension = getAvatarExtension(file);
  const filePath = `players/${crypto.randomUUID()}.${extension}`;

  const { error: uploadError } = await window.togwSupabase.storage
    .from(bucket)
    .upload(filePath, file, {
      cacheControl: '3600',
      upsert: false,
      contentType: file.type,
    });

  if (uploadError) throw uploadError;

  const { data } = window.togwSupabase.storage.from(bucket).getPublicUrl(filePath);
  return data.publicUrl;
}

function validateStep1(data) {
  if (!data.telephone) {
    throw new Error('Veuillez indiquer votre numéro de téléphone.');
  }

  if (data.ancien_participant) {
    if (!data.existing_player_id) {
      throw new Error('Sélectionnez votre pseudo dans la liste.');
    }
    return;
  }

  if (!data.nom || !data.prenom || !data.adresse) {
    throw new Error('Veuillez remplir tous les champs obligatoires.');
  }
  validateAvatarFile(data.avatarFile);
  const conditions = document.querySelectorAll('#conditionsSection input[type="checkbox"][required]');
  for (const checkbox of conditions) {
    if (!checkbox.checked) {
      throw new Error('Veuillez accepter toutes les conditions.');
    }
  }
}

function renderRecap() {
  const recap = document.getElementById('paymentRecap');
  const ticketType = resolveTicketType(formState.data.ancien_participant, { throwOnMissing: false });
  const amount = getDisplayAmount(formState.data.ancien_participant);
  if (!recap || !formState.data) return;

  if (formState.data.ancien_participant) {
    const player = getSelectedExistingPlayer();
    recap.innerHTML = `
      <p class="font-bold text-on-surface">${player?.name || 'Joueur existant'}</p>
      <p class="text-sm text-on-surface-variant">${formState.data.telephone}</p>
      <p class="text-sm text-on-surface-variant mt-2">Ancien participant · ${ticketType?.name || getConfig().TICKET_TYPE_NAME} · ${formatPrix(amount)}</p>
    `;
  } else {
    recap.innerHTML = `
      <p class="font-bold text-on-surface">${formState.data.prenom} ${formState.data.nom}</p>
      <p class="text-sm text-on-surface-variant">${formState.data.telephone}${formState.data.email ? ` · ${formState.data.email}` : ''}</p>
      <p class="text-sm text-on-surface-variant mt-2">${ticketType?.name || getConfig().TICKET_TYPE_NAME} · ${formatPrix(amount)}</p>
    `;
  }

  const amountEl = document.getElementById('paymentAmount');
  if (amountEl) amountEl.textContent = formatPrix(amount);
}

async function loadEventTicketTypes() {
  const config = getConfig();
  const response = await fetch(
    `${config.API_BASE}/api/auth/events/${config.EVENT_ID}/public-landing-page`
  );
  const result = await response.json().catch(() => ({}));

  if (!response.ok || !result.success) {
    throw new Error(result.error || 'Impossible de charger les types de billets.');
  }

  formState.ticketTypes = result.ticketTypes || [];
  resolveTicketType(formState.data.ancien_participant);
  return formState.ticketTypes;
}

async function loadPaymentMethods() {
  const container = document.getElementById('paymentMethodsList');
  if (!container) return;

  container.innerHTML = '<p class="text-on-surface-variant text-sm">Chargement des méthodes de paiement...</p>';

  const config = getConfig();
  const response = await fetch(`${config.API_BASE}/api/auth/payment-methods`);
  const result = await response.json();

  if (!response.ok || !result.success) {
    throw new Error(result.error || 'Impossible de charger les méthodes de paiement.');
  }

  formState.paymentMethods = result.payment_methods.filter((method) => method.is_active);
  if (!formState.paymentMethods.length) {
    throw new Error('Aucune méthode de paiement disponible.');
  }

  container.innerHTML = formState.paymentMethods
    .map(
      (method, index) => `
      <label class="block border border-outline-variant/30 p-4 cursor-pointer hover:border-secondary transition-colors ${index === 0 ? 'border-secondary/60' : ''}">
        <div class="flex items-start gap-4">
          <input type="radio" name="payment_method" value="${method.id}" class="checkbox-custom mt-1" ${index === 0 ? 'checked' : ''} required/>
          <div class="flex-1">
            <p class="font-black uppercase tracking-widest text-secondary text-sm">${method.Operateur}</p>
            <p class="text-on-surface font-bold mt-1">${method.numero}</p>
            <p class="text-xs text-on-surface-variant mt-1">${method.account_holder}</p>
          </div>
        </div>
      </label>
    `
    )
    .join('');
}

async function goToStep2() {
  const form = document.getElementById('inscriptionForm');

  try {
    const data = collectStep1Data(form);
    validateStep1(data);
    formState.data = data;
  } catch (err) {
    showError(err.message);
    return;
  }

  formState.step = 2;
  updateStepIndicator(2);
  renderRecap();
  showPanel('step2Panel');

  try {
    await loadEventTicketTypes();
    await loadPaymentMethods();
    renderRecap();
  } catch (err) {
    showError(err.message);
  }
}

function goToStep1() {
  formState.step = 1;
  updateStepIndicator(1);
  showPanel('step1Panel');
}

function buildPurchasePayload(paymentMethod, transactionId) {
  const data = formState.data;
  const ticketType = resolveTicketType(data.ancien_participant);
  const existingPlayer = getSelectedExistingPlayer();

  return {
    ticket_type_id: String(ticketType.id),
    quantity: 1,
    buyer_name: existingPlayer?.name || `${data.prenom} ${data.nom}`.trim(),
    buyer_phone: data.telephone,
    buyer_email: data.email || null,
    buyer_address: data.ancien_participant ? null : data.adresse || null,
    transaction_id: transactionId.trim(),
    total_amount: Number(ticketType.price),
    payment_method: Number(paymentMethod),
  };
}

async function purchaseTicket(payload) {
  const config = getConfig();
  const response = await fetch(
    `${config.API_BASE}/api/auth/events/${config.EVENT_ID}/purchase-ticket`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }
  );

  const result = await response.json().catch(() => ({}));
  if (!response.ok || result.success === false) {
    throw new Error(result.error || result.message || `Erreur paiement (${response.status})`);
  }

  return result;
}

async function checkDuplicate(playerName) {
  const config = getConfig();
  const { data: players, error } = await window.togwSupabase
    .from('players')
    .select('id')
    .eq('name', playerName);

  if (error) throw error;
  if (!players?.length) return false;

  const { data: participants, error: participantError } = await window.togwSupabase
    .from('tournament_participants')
    .select('id')
    .eq('tournament_id', config.TOURNAMENT_ID)
    .in('player_id', players.map((player) => player.id))
    .limit(1);

  if (participantError) throw participantError;
  return Boolean(participants?.length);
}

async function registerExistingPlayer(options = {}) {
  ensureSupabaseReady();

  const data = formState.data;
  const playerId = data.existing_player_id;
  const participantStatus = options.status || 'pending';

  if (!playerId) {
    throw new Error('Sélectionnez votre pseudo dans la liste.');
  }

  const { data: participants, error: checkError } = await window.togwSupabase
    .from('tournament_participants')
    .select('id')
    .eq('tournament_id', getConfig().TOURNAMENT_ID)
    .eq('player_id', playerId)
    .limit(1);

  if (checkError) throw checkError;
  if (participants?.length) {
    const duplicateError = new Error('DUPLICATE');
    duplicateError.code = 'DUPLICATE';
    throw duplicateError;
  }

  const { error: participantError } = await window.togwSupabase
    .from('tournament_participants')
    .insert({
      tournament_id: getConfig().TOURNAMENT_ID,
      player_id: playerId,
      status: participantStatus,
    });

  if (participantError) {
    if (participantError.code === '23505') {
      const duplicateError = new Error('DUPLICATE');
      duplicateError.code = 'DUPLICATE';
      throw duplicateError;
    }
    throw participantError;
  }

  const player = getSelectedExistingPlayer();
  return { id: playerId, name: player?.name || 'Joueur' };
}

async function saveToSupabase(options = {}) {
  ensureSupabaseReady();

  const data = formState.data;
  const playerName = data.pseudo || `${data.prenom} ${data.nom}`;
  const participantStatus = options.status || 'pending';

  if (await checkDuplicate(playerName)) {
    const duplicateError = new Error('DUPLICATE');
    duplicateError.code = 'DUPLICATE';
    throw duplicateError;
  }

  let avatarUrl = null;
  if (data.avatarFile) {
    avatarUrl = await uploadPlayerAvatar(data.avatarFile);
  }

  const { data: player, error: playerError } = await window.togwSupabase
    .from('players')
    .insert({
      name: playerName,
      main_character: data.pseudo || null,
      avatar_url: avatarUrl,
    })
    .select('id')
    .single();

  if (playerError) throw playerError;

  const { error: participantError } = await window.togwSupabase
    .from('tournament_participants')
    .insert({
      tournament_id: getConfig().TOURNAMENT_ID,
      player_id: player.id,
      status: participantStatus,
    });

  if (participantError) {
    if (participantError.code === '23505') {
      const duplicateError = new Error('DUPLICATE');
      duplicateError.code = 'DUPLICATE';
      throw duplicateError;
    }
    throw participantError;
  }

  return player;
}

function extractPurchasedTicket(purchaseResult) {
  const tickets = purchaseResult?.tickets;
  if (Array.isArray(tickets) && tickets.length > 0) {
    return tickets[0];
  }

  const ticketId = purchaseResult?.ticket_ids?.[0];
  if (ticketId) {
    return {
      id: ticketId,
      number: purchaseResult?.ticket_number || '—',
      ticket_type: getConfig().TICKET_TYPE_NAME,
    };
  }

  return null;
}

function getTicketQrPayload(ticketId) {
  const base = getConfig().TICKET_QR_BASE_URL?.replace(/\/$/, '');
  return base ? `${base}/ticket/${ticketId}` : String(ticketId);
}

function getTicketDisplayLabel(ticket) {
  return `Ticket n°${ticket.number} | ${ticket.ticket_type}`;
}

function ensureQrLibrary() {
  if (!window.QRCode?.toCanvas) {
    throw new Error('La bibliothèque QR Code est indisponible. Rechargez la page.');
  }
}

async function renderQrCode(ticket) {
  ensureQrLibrary();

  const container = document.getElementById('qrCodeContainer');
  const codeEl = document.getElementById('userCode');
  if (!container || !ticket?.id) {
    throw new Error('Impossible d’afficher le QR code du billet.');
  }

  formState.purchasedTicket = ticket;
  formState.qrDownloadBlob = null;
  if (codeEl) codeEl.textContent = getTicketDisplayLabel(ticket);

  container.innerHTML = '';
  const canvas = document.createElement('canvas');
  container.appendChild(canvas);

  await window.QRCode.toCanvas(canvas, getTicketQrPayload(ticket.id), {
    width: 220,
    margin: 2,
    color: { dark: '#050d25', light: '#ffffff' },
  });

  formState.qrDownloadBlob = await createTicketQrPng(ticket);
}

async function createTicketQrPng(ticket) {
  ensureQrLibrary();

  const canvas = document.createElement('canvas');
  const width = 420;
  const height = 520;
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Impossible de créer l’image du QR code.');

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);

  const qrCanvas = document.createElement('canvas');
  await window.QRCode.toCanvas(qrCanvas, getTicketQrPayload(ticket.id), {
    width: 300,
    margin: 2,
    color: { dark: '#050d25', light: '#ffffff' },
  });

  const qrSize = 300;
  const qrX = (width - qrSize) / 2;
  const qrY = 32;
  ctx.drawImage(qrCanvas, qrX, qrY, qrSize, qrSize);

  ctx.fillStyle = '#050d25';
  ctx.font = 'bold 20px Space Grotesk, system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(getTicketDisplayLabel(ticket), width / 2, qrY + qrSize + 42, width - 40);

  ctx.fillStyle = '#6d7491';
  ctx.font = '500 13px Manrope, system-ui, sans-serif';
  ctx.fillText('ToGW · Road to the Finals', width / 2, height - 28);

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('Échec de la génération du PNG.'));
        return;
      }
      resolve(blob);
    }, 'image/png');
  });
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

async function downloadQrCode() {
  const ticket = formState.purchasedTicket;
  if (!ticket) {
    showError('Aucun billet disponible pour le téléchargement.');
    return;
  }

  const downloadBtn = document.getElementById('btn-download-qr');
  const originalHtml = downloadBtn?.innerHTML;
  if (downloadBtn) {
    downloadBtn.disabled = true;
    downloadBtn.innerHTML = '<span>GÉNÉRATION...</span>';
  }

  try {
    const blob = formState.qrDownloadBlob || (await createTicketQrPng(ticket));
    formState.qrDownloadBlob = blob;
    const safeType = String(ticket.ticket_type || 'ticket').replace(/[^\w\-]+/g, '_');
    downloadBlob(blob, `ToGW-ticket-${ticket.number}-${safeType}.png`);
  } catch (err) {
    showError(err.message || 'Impossible de télécharger le QR code.');
  } finally {
    if (downloadBtn) {
      downloadBtn.disabled = false;
      downloadBtn.innerHTML = originalHtml;
    }
  }
}

function showError(message) {
  const text = document.getElementById('errorMessageText');
  if (text) text.textContent = message;
  showPanel('errorMessage');
}

async function handleAdminSubmit() {
  const form = document.getElementById('inscriptionForm');
  const submitBtn = document.getElementById('btnStep1Submit');
  const originalHtml = submitBtn?.innerHTML;

  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span>TRAITEMENT...</span>';
  }

  try {
    const data = collectStep1Data(form);
    validateStep1(data);
    formState.data = data;
    ensureSupabaseReady();
    if (data.ancien_participant) {
      await registerExistingPlayer({ status: 'confirmed' });
    } else {
      await saveToSupabase({ status: 'confirmed' });
    }
    form.reset();
    document.getElementById('ancien_participant').checked = true;
    resetAvatarField();
    updateReturningParticipantUi();
    showPanel('adminSuccessMessage');
  } catch (err) {
    if (err.code === 'DUPLICATE') {
      showPanel('duplicateMessage');
    } else {
      showError(err.message || 'Une erreur est survenue.');
    }
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = originalHtml;
    }
  }
}

async function handlePaymentSubmit(event) {
  event.preventDefault();

  const submitBtn = document.getElementById('btnConfirmPayment');
  const originalHtml = submitBtn.innerHTML;
  submitBtn.disabled = true;
  submitBtn.innerHTML = '<span>TRAITEMENT...</span>';

  try {
    const paymentMethod = document.querySelector('input[name="payment_method"]:checked')?.value;
    const transactionId = document.getElementById('transactionReference')?.value?.trim();

    if (!paymentMethod) throw new Error('Choisissez une méthode de paiement.');
    if (!transactionId) throw new Error('Indiquez la référence de votre transaction.');

    ensureSupabaseReady();

    const payload = buildPurchasePayload(paymentMethod, transactionId);
    const purchaseResult = await purchaseTicket(payload);
    const player = formState.data.ancien_participant
      ? await registerExistingPlayer()
      : await saveToSupabase();
    const ticket =
      extractPurchasedTicket(purchaseResult) || {
        id: player.id,
        number: '—',
        ticket_type: getConfig().TICKET_TYPE_NAME,
      };

    await renderQrCode(ticket);
    showPanel('successMessage');
  } catch (err) {
    if (err.code === 'DUPLICATE') {
      showPanel('duplicateMessage');
    } else {
      showError(err.message || 'Une erreur est survenue.');
    }
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerHTML = originalHtml;
  }
}

function setupInscriptionWizard() {
  document.getElementById('inscriptionForm')?.addEventListener('submit', (event) => {
    event.preventDefault();
    if (isAdminMode()) {
      handleAdminSubmit();
    } else {
      goToStep2();
    }
  });

  document.getElementById('btnBackStep1')?.addEventListener('click', goToStep1);
  document.getElementById('paymentForm')?.addEventListener('submit', handlePaymentSubmit);
  document.getElementById('btn-admin-new-registration')?.addEventListener('click', () => {
    document.getElementById('inscriptionForm')?.reset();
    document.getElementById('ancien_participant').checked = true;
    resetAvatarField();
    updateReturningParticipantUi();
    formState.data = null;
    formState.step = 1;
    updateStepIndicator(1);
    showPanel('step1Panel');
  });

  document.getElementById('inscriptionForm')?.addEventListener('reset', () => {
    window.setTimeout(() => {
      document.getElementById('ancien_participant').checked = true;
      updateReturningParticipantUi();
    }, 0);
  });

  document.getElementById('ancien_participant')?.addEventListener('change', updateReturningParticipantUi);

  window.TOGWAuth?.onAuthChange?.(() => applyTogwAdminInscriptionUi());

  document.getElementById('btn-home-success')?.addEventListener('click', () => {
    window.location.href = '../index.html';
  });
  document.getElementById('btn-home-duplicate')?.addEventListener('click', () => {
    window.location.href = '../index.html';
  });
  document.getElementById('btn-home-error')?.addEventListener('click', () => {
    if (formState.step === 2) {
      showPanel('step2Panel');
    } else {
      goToStep1();
    }
  });
  document.getElementById('btn-download-qr')?.addEventListener('click', () => {
    downloadQrCode();
  });

  setupAvatarField();
  updateReturningParticipantUi();
  loadExistingPlayers().catch((err) => console.error('Chargement joueurs:', err));
  updateStepIndicator(1);
  showPanel('step1Panel');
  showSetupWarnings();
  applyTogwAdminInscriptionUi();
}

document.addEventListener('DOMContentLoaded', setupInscriptionWizard);
