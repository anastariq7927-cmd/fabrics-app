/* 
 - FabriCS — Formulaire de contact interactif
 - Emplacement : public/scripts/fabrics-contact-form.js
 - Chargement  : <script is:inline src="/scripts/fabrics-contact-form.js" defer></script>
 - Script autonome (aucun import, aucune dépendance, CSS inclus).
 - Il remplit <div id="contact-form-container"></div>.
*/
(function () {
  'use strict';

  var CONTAINER_ID = 'contact-form-container';
  var API_URL = '/api/contact';
  var MAX_FILE_MB = 25;

  /* ------------------------------------------------------------------ */
  /* DESIGN ET STYLES CSS DU FORMULAIRE                                 */
  /* ------------------------------------------------------------------ */
  var CSS = '\
.fcs {\
  /* ==================================================================\
     1. PERSONNALISATION DES COULEURS PRINCIPALES\
     ================================================================== */\
  --bg: #0b0b0c;          /* <-- COULEUR DE FOND DU FORMULAIRE (Sombre) */\
  --card: #141416;        /* <-- FOND DES BLOCS CONDITIONNELS ("Autre") */\
  --line: #2b2b30;        /* <-- COULEUR DES BORDURES INTERNES ET SÉPARATEURS */\
  --txt: #f4f2ef;         /* <-- COULEUR DU TEXTE PRINCIPAL (Clair) */\
  --mute: #a7a4a0;        /* <-- COULEUR DU TEXTE SECONDAIRE / INDICATIONS */\
  --acc: #7a1232;         /* <-- COULEUR D\'ACCENTUATION (Grenade) */\
  --acc2: #b3214a;        /* <-- COULEUR D\'ACCENTUATION BRIGHT (Grenade Clair) */\
  --err: #ff6b81;         /* <-- COULEUR DES MESSAGES D\'ERREUR (Rouge) */\
\
  /* ==================================================================\
     2. ARRIÈRE-PLAN (COULEUR OU IMAGE DE FOND)\
     ================================================================== */\
  /*background-color: var(--bg);*/\
  background-image: linear-gradient(rgba(11, 11, 12, 0.85), rgba(11, 11, 12, 0.85)), url("../ecosysteme.JPG"); \
   background-size: cover; \
  background-position: center; \
\
  /* ==================================================================\
     3. BORDURES ET CADRE DE LA FENÊTRE DU FORMULAIRE\
     ================================================================== */\
  border: 1px solid rgba(179,33,74,.35); /* <-- BORDURE EXTÉRIEURE DE LA FENÊTRE */\
   border-radius: 20px;               /* <-- DÉCOMMENTER POUR ARRONDIR LES ANGLES */\
  box-shadow: 0 10px 30px rgba(0,0,0,0.5); /* <-- DÉCOMMENTER POUR UNE OMBRE */\
\
  color: var(--txt);\
  padding: 2rem 1.25rem;\
  font-family: inherit;\
  line-height: 1.5;\
  box-sizing: border-box;\
}\
.fcs * { box-sizing: border-box; }\
@media(min-width:768px) { .fcs { padding: 3rem; } }\
\
/* --------------------------------------------------------------------\
   4. COULEURS DU TEXTE (TITRES, SOUS-TITRES, LABELS)\
   -------------------------------------------------------------------- */\
.fcs-eyebrow {\
  display: block;\
  font-size: .75rem;\
  letter-spacing: .18em;\
  text-transform: uppercase;\
  color: var(--acc2);\
  margin-bottom: .5rem;\
}\
.fcs h2 {\
  font-size: clamp(1.75rem,4vw,2.5rem);\
  font-weight: 700;\
  margin: 0 0 .75rem;\
  letter-spacing: -.01em;\
  color: var(--txt);\
}\
.fcs-intro {\
  color: var(--mute);\
  max-width: 42rem;\
  margin: 0 0 2rem;\
}\
.fcs-progress { display: flex; gap: .5rem; margin-bottom: .5rem; }\
.fcs-progress span { flex: 1; height: 3px; background: var(--line); transition: background .25s; }\
.fcs-progress span.done { background: var(--acc2); }\
.fcs-stepname {\
  font-size: .75rem;\
  letter-spacing: .14em;\
  text-transform: uppercase;\
  color: var(--mute);\
  margin-bottom: 1.75rem;\
}\
.fcs-panel { display: none; }\
.fcs-panel.active { display: block; animation: fcsin .25s ease; }\
@keyframes fcsin { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }\
.fcs fieldset { border: 0; margin: 0; padding: 0; min-width: 0; }\
.fcs-field { margin-bottom: 1.25rem; }\
.fcs-field>label, .fcs-label {\
  display: block;\
  font-size: .75rem;\
  letter-spacing: .1em;\
  text-transform: uppercase;\
  margin-bottom: .5rem;\
  color: var(--txt);\
}\
.fcs-req { color: var(--acc2); }\
.fcs-opt { color: var(--mute); text-transform: none; letter-spacing: 0; }\
\
/* --------------------------------------------------------------------\
   5. CHAMPS DE SAISIE (INPUTS, SELECT, TEXTAREA)\
   -------------------------------------------------------------------- */\
.fcs input[type=text], .fcs input[type=email], .fcs input[type=tel], .fcs select, .fcs textarea {\
  width: 100%;\
  background: var(--bg);\
  color: var(--txt);\
  border: 1px solid var(--line);\
  padding: .75rem 1rem;\
  font: inherit;\
  font-size: .9rem;\
  border-radius: 15;\
  outline: none;\
  transition: border-color .2s;\
}\
.fcs textarea { resize: vertical; min-height: 7rem; }\
.fcs select {\
  appearance: none;\
  background-image: linear-gradient(45deg,transparent 50%,var(--mute) 50%),linear-gradient(135deg,var(--mute) 50%,transparent 50%);\
  background-position: calc(100% - 18px) 50%,calc(100% - 13px) 50%;\
  background-size: 5px 5px;\
  background-repeat: no-repeat;\
  padding-right: 2.5rem;\
}\
.fcs input:focus, .fcs select:focus, .fcs textarea:focus { border-color: var(--acc2); }\
.fcs-field.has-error input, .fcs-field.has-error select, .fcs-field.has-error textarea { border-color: var(--err); }\
.fcs-error { display: none; color: var(--err); font-size: .8rem; margin-top: .4rem; }\
.fcs-field.has-error .fcs-error { display: block; }\
.fcs-grid { display: grid; gap: 1.25rem; grid-template-columns: 1fr; }\
@media(min-width:768px) { .fcs-grid { grid-template-columns: 1fr 1fr; } }\
\
/* --------------------------------------------------------------------\
   6. BLOCS CONDITIONNELS (ENCADRÉ "AUTRE")\
   -------------------------------------------------------------------- */\
.fcs-cond {\
  display: none;\
  border-left: 2px solid var(--acc2);\
  background: var(--card);\
  padding: 1rem;\
}\
.fcs-cond.show { display: block; animation: fcsin .25s ease; }\
.fcs input[type=file] { display: block; width: 100%; font-size: .8rem; color: var(--mute); }\
.fcs input[type=file]::file-selector-button {\
  margin-right: 1rem;\
  padding: .5rem 1rem;\
  border: 1px solid var(--acc2);\
  background: transparent;\
  color: var(--txt);\
  cursor: pointer;\
  font: inherit;\
  font-size: .8rem;\
  transition: background .2s;\
}\
.fcs input[type=file]::file-selector-button:hover { background: var(--acc); }\
.fcs-files { margin: .5rem 0 0; padding: 0; list-style: none; font-size: .8rem; color: var(--mute); }\
.fcs-hint { font-size: .8rem; color: var(--mute); margin: .4rem 0 0; }\
\
/* --------------------------------------------------------------------\
   7. SÉPARATEURS ET NAVIGATION\
   -------------------------------------------------------------------- */\
.fcs-nav {\
  display: flex;\
  justify-content: space-between;\
  gap: 1rem;\
  margin-top: 2rem;\
  padding-top: 1.5rem;\
  border-top: 1px solid rgba(179,33,74,.25);\
}\
.fcs-nav.end { justify-content: flex-end; }\
\
/* --------------------------------------------------------------------\
   8. BOUTONS\
   -------------------------------------------------------------------- */\
.fcs-btn {\
  font: inherit;\
  font-size: .85rem;\
  letter-spacing: .04em;\
  padding: .8rem 1.6rem;\
  border: 1px solid var(--acc2);\
  background: transparent;\
  color: var(--txt);\
  cursor: pointer;\
  transition: background .2s, color .2s, border-color .2s;\
}\
.fcs-btn:hover { background: var(--acc); }\
.fcs-btn.primary { background: var(--acc); font-weight: 700; }\
.fcs-btn.primary:hover { background: var(--acc2); }\
.fcs-btn.ghost { border-color: var(--line); color: var(--mute); }\
.fcs-btn.ghost:hover { border-color: var(--txt); color: var(--txt); background: transparent; }\
.fcs-btn:disabled { opacity: .55; cursor: wait; }\
.fcs-recap { margin: 0; padding: 0; list-style: none; border: 1px solid var(--line); }\
.fcs-recap li { display: grid; gap: .25rem; padding: .85rem 1rem; border-bottom: 1px solid var(--line); font-size: .9rem; }\
.fcs-recap li:last-child { border-bottom: 0; }\
@media(min-width:640px) { .fcs-recap li { grid-template-columns: 14rem 1fr; gap: 1rem; } }\
.fcs-recap b { font-weight: 400; color: var(--mute); }\
.fcs-recap span { white-space: pre-wrap; word-break: break-word; }\
.fcs-status { margin-top: 1rem; font-size: .9rem; color: var(--err); min-height: 1.2em; }\
.fcs-success { text-align: center; padding: 3rem 1rem; }\
.fcs-success h3 { font-size: 1.5rem; margin: 0 0 .75rem; color: var(--txt); }\
.fcs-success p { color: var(--mute); margin: 0 0 1.5rem; }\
.fcs-hp { position: absolute; left: -9999px; width: 1px; height: 1px; overflow: hidden; }\
';

  /* ------------------------------------------------------------------ */
  /* Gabarit HTML                                                       */
  /* ------------------------------------------------------------------ */
  function field(label, inner, opts) {
    opts = opts || {};
    return '<div class="fcs-field">' +
      '<label' + (opts.forId ? ' for="' + opts.forId + '"' : '') + '>' + label +
      (opts.required ? ' <span class="fcs-req">*</span>' : '') +
      (opts.optional ? ' <span class="fcs-opt">(facultatif)</span>' : '') +
      '</label>' + inner + '<span class="fcs-error" role="alert"></span></div>';
  }

  function template() {
    return '\
<div class="fcs" id="fcs-root">\
  <span class="fcs-eyebrow">Contact & demandes</span>\
  <h2>Formulaire de contact</h2>\
  <p class="fcs-intro">L\'association de CentraleSupélec, localisée à Metz, vous accompagne dans tous vos projets de conception technique, de modélisation et d\'impression.</p>\
\
  <div class="fcs-progress" aria-hidden="true"><span></span><span></span><span></span><span></span></div>\
  <div class="fcs-stepname" id="fcs-stepname" aria-live="polite"></div>\
\
  <form id="fabrics-contact-form" novalidate enctype="multipart/form-data">\
\
    <!-- ÉTAPE 1 -->\
    <div class="fcs-panel" data-panel="1">\
      <fieldset>\
        ' + field('Qui êtes-vous ?',
          '<select id="fcs-profil" name="quiEtesVous">\
            <option value="">-- Sélectionnez votre profil --</option>\
            <option value="etudiant_cotisant">Étudiant de CentraleSupélec cotisant</option>\
            <option value="etudiant_non_cotisant">Étudiant de CentraleSupélec non cotisant</option>\
            <option value="personnel_interne">Personnel interne à CentraleSupélec</option>\
            <option value="entreprise_collectivite">Entreprises, collectivités, organisations ...</option>\
            <option value="autre">Autre</option>\
          </select>', { forId: 'fcs-profil', required: true }) + '\
        <div class="fcs-cond" data-for="quiEtesVous" data-value="autre">\
          ' + field('Veuillez préciser votre profil',
            '<input type="text" name="autreProfilPrecision" id="fcs-autre-profil" placeholder="Ex : ancien élève, partenaire...">',
            { forId: 'fcs-autre-profil', required: true }) + '\
        </div>\
        <div class="fcs-grid">\
          ' + field('Adresse mail', '<input type="email" id="fcs-email" name="email" placeholder="nom@exemple.com" autocomplete="email">', { forId: 'fcs-email', required: true }) + '\
          ' + field('Numéro de téléphone', '<input type="tel" id="fcs-tel" name="telephone" placeholder="06 12 34 56 78" autocomplete="tel">', { forId: 'fcs-tel', optional: true }) + '\
        </div>\
        <div class="fcs-hp" aria-hidden="true"><label>Ne pas remplir<input type="text" name="website" tabindex="-1" autocomplete="off"></label></div>\
      </fieldset>\
      <div class="fcs-nav end"><button type="button" class="fcs-btn" data-action="next">Suivant →</button></div>\
    </div>\
\
    <!-- ÉTAPE 2A : parcours interne / étudiant / autre -->\
    <div class="fcs-panel" data-panel="2-interne">\
      <fieldset data-branch="interne">\
        ' + field('Que souhaitez-vous faire ?',
          '<select id="fcs-besoin-int" name="besoinInterne">\
            <option value="">-- Choisir une prestation --</option>\
            <option value="Impression 3D">Impression 3D</option>\
            <option value="Gravure ou découpe laser">Gravure ou découpe laser</option>\
            <option value="Aide à la conception matérielle ou 3D">Aide à la conception matérielle ou 3D</option>\
            <option value="Service ou conseil autre">Service ou conseil autre</option>\
          </select>', { forId: 'fcs-besoin-int', required: true }) + '\
        <div class="fcs-cond" data-for="besoinInterne" data-value="Service ou conseil autre">\
          ' + field('Précisez le service ou conseil souhaité',
            '<input type="text" name="autreBesoinInternePrecision" id="fcs-autre-besoin" placeholder="Décrivez succinctement votre besoin...">',
            { forId: 'fcs-autre-besoin', required: true }) + '\
        </div>\
        ' + field('Dans quel cadre est votre projet ?',
          '<select id="fcs-cadre" name="cadreProjet">\
            <option value="">-- Choisir le cadre --</option>\
            <option value="Projet entre élèves">Projet entre élèves</option>\
            <option value="Projet académique">Projet académique</option>\
            <option value="Projet associatif">Projet associatif</option>\
            <option value="Projet personnel">Projet personnel</option>\
            <option value="Prestation externe">Prestation externe (entreprises, associations...)</option>\
            <option value="Autre">Autre</option>\
          </select>', { forId: 'fcs-cadre', required: true }) + '\
        <div class="fcs-cond" data-for="cadreProjet" data-value="Projet associatif">\
          ' + field('Pour quelle association / club de CS ?',
            '<input type="text" name="nomAssociation" id="fcs-asso" placeholder="Ex : BDE, FabriCS, Club Robotique...">',
            { forId: 'fcs-asso', optional: true }) + '\
        </div>\
        <div class="fcs-cond" data-for="cadreProjet" data-value="Autre">\
          ' + field('Précisez le cadre de votre projet',
            '<input type="text" name="autreCadrePrecision" id="fcs-autre-cadre" placeholder="Précisez le contexte...">',
            { forId: 'fcs-autre-cadre', required: true }) + '\
        </div>\
      </fieldset>\
      <div class="fcs-nav">\
        <button type="button" class="fcs-btn ghost" data-action="prev">← Retour</button>\
        <button type="button" class="fcs-btn" data-action="next">Suivant →</button>\
      </div>\
    </div>\
\
    <!-- ÉTAPE 2B : parcours entreprises -->\
    <div class="fcs-panel" data-panel="2-entreprise">\
      <fieldset data-branch="entreprise">\
        ' + field('Que souhaitez-vous faire ?',
          '<select id="fcs-besoin-ent" name="besoinEntreprise">\
            <option value="">-- Choisir une option --</option>\
            <option value="Prestation événementielle">Prestation événementielle</option>\
            <option value="Prestation technique">Prestation technique (conception matérielle ou logicielle)</option>\
            <option value="Autre demande">Autre demande</option>\
          </select>', { forId: 'fcs-besoin-ent', required: true }) + '\
        <div class="fcs-cond" data-for="besoinEntreprise" data-value="Autre demande">\
          ' + field('Précisez votre demande',
            '<input type="text" name="autreEntreprisePrecision" id="fcs-autre-ent" placeholder="Précisez la nature de votre demande...">',
            { forId: 'fcs-autre-ent', required: true }) + '\
        </div>\
        ' + field('Pourriez-vous détailler votre proposition ?',
          '<textarea id="fcs-detail" name="detailProposition" rows="5" placeholder="Description de votre projet ou besoin..."></textarea>',
          { forId: 'fcs-detail', required: true }) + '\
      </fieldset>\
      <div class="fcs-nav">\
        <button type="button" class="fcs-btn ghost" data-action="prev">← Retour</button>\
        <button type="button" class="fcs-btn" data-action="next">Suivant →</button>\
      </div>\
    </div>\
\
    <!-- ÉTAPE 3 : remarques + fichiers -->\
    <div class="fcs-panel" data-panel="3">\
      <fieldset>\
        ' + field('Avez-vous d\'autres remarques ?',
          '<textarea id="fcs-remarques" name="remarques" rows="4" placeholder="Informations complémentaires, contraintes de délai..."></textarea>',
          { optional: true }) + '\
        <div class="fcs-cond" data-branch="interne" data-for="besoinInterne" data-value="Impression 3D">\
          ' + field('Fichier 3D (pour impression 3D)',
            '<input type="file" name="fichier3d" accept=".stl,.obj,.step,.stp,.3mf" data-files>\
             <ul class="fcs-files"></ul><p class="fcs-hint">Formats : STL, OBJ, STEP, 3MF.</p>', { optional: true }) + '\
        </div>\
        <div class="fcs-cond" data-branch="interne" data-for="besoinInterne" data-value="Gravure ou découpe laser">\
          ' + field('Images ou plans (pour gravure / découpe laser)',
            '<input type="file" name="images" accept="image/*,.svg,.dxf,.pdf" multiple data-files>\
             <ul class="fcs-files"></ul><p class="fcs-hint">Idéalement en vectoriel (SVG, DXF).</p>', { optional: true }) + '\
        </div>\
        ' + field('Autres documents',
          '<input type="file" name="autresDocuments" multiple data-files><ul class="fcs-files"></ul>',
          { optional: true }) + '\
      </fieldset>\
      <div class="fcs-nav">\
        <button type="button" class="fcs-btn ghost" data-action="prev">← Retour</button>\
        <button type="button" class="fcs-btn" data-action="next">Vérifier →</button>\
      </div>\
    </div>\
\
    <!-- ÉTAPE 4 : récapitulatif -->\
    <div class="fcs-panel" data-panel="4">\
      <p class="fcs-intro" style="margin-bottom:1rem">Vérifiez vos informations avant l\'envoi.</p>\
      <ul class="fcs-recap" id="fcs-recap"></ul>\
      <div class="fcs-status" id="fcs-status" role="alert"></div>\
      <div class="fcs-nav">\
        <button type="button" class="fcs-btn ghost" data-action="prev">← Modifier</button>\
        <button type="submit" class="fcs-btn primary" id="fcs-submit">Envoyer la demande →</button>\
      </div>\
    </div>\
\
  </form>\
</div>';
  }

  /* ------------------------------------------------------------------ */
  /* Logique                                                            */
  /* ------------------------------------------------------------------ */
  var STEP_NAMES = {
    '1': 'Étape 1 / 4 — Vos coordonnées',
    '2-interne': 'Étape 2 / 4 — Votre besoin',
    '2-entreprise': 'Étape 2 / 4 — Votre proposition',
    '3': 'Étape 3 / 4 — Remarques et fichiers',
    '4': 'Étape 4 / 4 — Récapitulatif'
  };
  var PROGRESS_INDEX = { '1': 1, '2-interne': 2, '2-entreprise': 2, '3': 3, '4': 4 };

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&', '<': '<', '>': '>', '"': '"', "'": '`' }[c];
    });
  }

  function formatSize(bytes) {
    if (bytes < 1024) return bytes + ' o';
    if (bytes < 1048576) return Math.round(bytes / 1024) + ' Ko';
    return (bytes / 1048576).toFixed(1) + ' Mo';
  }

  function init() {
    var container = document.getElementById(CONTAINER_ID);
    if (!container) {
      var host = document.getElementById('contact') || document.querySelector('main') || document.body;
      container = document.createElement('div');
      container.id = CONTAINER_ID;
      host.appendChild(container);
    }

    if (!document.getElementById('fcs-style')) {
      var style = document.createElement('style');
      style.id = 'fcs-style';
      style.textContent = CSS;
      document.head.appendChild(style);
    }

    container.innerHTML = template();

    var root = container.querySelector('#fcs-root');
    var form = container.querySelector('#fabrics-contact-form');
    var stepName = container.querySelector('#fcs-stepname');
    var progress = container.querySelectorAll('.fcs-progress span');
    var panels = {};
    form.querySelectorAll('.fcs-panel').forEach(function (p) { panels[p.dataset.panel] = p; });

    var current = '1';
    var history = [];

    function val(name) {
      var el = form.elements[name];
      return el && el.value ? el.value.trim() : '';
    }
    function selText(name) {
      var el = form.elements[name];
      return el && el.value ? el.options[el.selectedIndex].text : '';
    }
    function branch() {
      return val('quiEtesVous') === 'entreprise_collectivite' ? 'entreprise' : 'interne';
    }

    function setError(el, msg) {
      var wrap = el.closest('.fcs-field');
      if (!wrap) return;
      wrap.classList.add('has-error');
      wrap.querySelector('.fcs-error').textContent = msg;
    }
    function clearError(el) {
      var wrap = el.closest('.fcs-field');
      if (!wrap) return;
      wrap.classList.remove('has-error');
      wrap.querySelector('.fcs-error').textContent = '';
    }

    function refreshConditionals() {
      var b = branch();

      form.querySelectorAll('fieldset[data-branch]').forEach(function (fs) {
        fs.disabled = fs.dataset.branch !== b;
      });

      form.querySelectorAll('.fcs-cond').forEach(function (c) {
        var src = form.elements[c.dataset.for];
        var show = !!src && src.value === c.dataset.value;
        if (c.dataset.branch && c.dataset.branch !== b) show = false;
        c.classList.toggle('show', show);
        c.querySelectorAll('input,select,textarea').forEach(function (i) {
          i.disabled = !show;
          if (!show) clearError(i);
        });
      });
    }

    function showPanel(name, noScroll) {
      Object.keys(panels).forEach(function (k) {
        panels[k].classList.toggle('active', k === name);
      });
      current = name;
      stepName.textContent = STEP_NAMES[name];
      var idx = PROGRESS_INDEX[name];
      progress.forEach(function (s, i) { s.classList.toggle('done', i < idx); });
      if (name === '4') buildRecap();
      if (!noScroll) root.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    function nextPanel() {
      if (current === '1') return branch() === 'entreprise' ? '2-entreprise' : '2-interne';
      if (current === '2-interne' || current === '2-entreprise') return '3';
      if (current === '3') return '4';
      return null;
    }

    function goNext() {
      if (!validate(current)) return;
      var n = nextPanel();
      if (!n) return;
      history.push(current);
      showPanel(n);
    }

    function goPrev() {
      var p = history.pop();
      if (p) showPanel(p);
    }

    function need(name, msg) {
      var el = form.elements[name];
      if (el && !el.disabled && !el.value.trim()) { setError(el, msg); return el; }
      return null;
    }

    function validate(panel) {
      form.querySelectorAll('.has-error').forEach(function (w) { w.classList.remove('has-error'); });
      var bad = [];
      function push(x) { if (x) bad.push(x); }

      if (panel === '1') {
        push(need('quiEtesVous', 'Veuillez sélectionner votre profil.'));
        if (val('quiEtesVous') === 'autre') push(need('autreProfilPrecision', 'Veuillez préciser votre profil.'));
        var email = form.elements.email;
        if (!email.value.trim()) { setError(email, 'Veuillez saisir votre adresse e-mail.'); bad.push(email); }
        else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value.trim())) { setError(email, 'Adresse e-mail invalide.'); bad.push(email); }
        var tel = form.elements.telephone;
        if (tel.value.trim() && !/^\+?[\d\s.()-]{6,20}$/.test(tel.value.trim())) {
          setError(tel, 'Numéro de téléphone invalide.'); bad.push(tel);
        }
      }

      if (panel === '2-interne') {
        push(need('besoinInterne', 'Veuillez indiquer ce que vous souhaitez faire.'));
        if (val('besoinInterne') === 'Service ou conseil autre') push(need('autreBesoinInternePrecision', 'Veuillez préciser le service ou conseil souhaité.'));
        push(need('cadreProjet', 'Veuillez sélectionner le cadre de votre projet.'));
        if (val('cadreProjet') === 'Autre') push(need('autreCadrePrecision', 'Veuillez préciser le cadre de votre projet.'));
      }

      if (panel === '2-entreprise') {
        push(need('besoinEntreprise', 'Veuillez indiquer ce que vous souhaitez faire.'));
        if (val('besoinEntreprise') === 'Autre demande') push(need('autreEntreprisePrecision', 'Veuillez préciser votre demande.'));
        push(need('detailProposition', 'Veuillez détailler votre proposition.'));
      }

      if (panel === '3') {
        form.querySelectorAll('input[type=file]').forEach(function (inp) {
          if (inp.disabled) return;
          for (var i = 0; i < inp.files.length; i++) {
            if (inp.files[i].size > MAX_FILE_MB * 1048576) {
              setError(inp, '« ' + inp.files[i].name + ' » dépasse ' + MAX_FILE_MB + ' Mo.');
              bad.push(inp);
              break;
            }
          }
        });
      }

      if (bad.length) { bad[0].focus(); return false; }
      return true;
    }

    function buildRecap() {
      var rows = [];
      function add(label, value) { if (value) rows.push([label, value]); }

      add('Profil', val('quiEtesVous') === 'autre'
        ? selText('quiEtesVous') + ' — ' + val('autreProfilPrecision')
        : selText('quiEtesVous'));
      add('E-mail', val('email'));
      add('Téléphone', val('telephone'));

      if (branch() === 'entreprise') {
        add('Demande', val('besoinEntreprise') === 'Autre demande'
          ? 'Autre — ' + val('autreEntreprisePrecision')
          : selText('besoinEntreprise'));
        add('Proposition', val('detailProposition'));
      } else {
        add('Prestation', val('besoinInterne') === 'Service ou conseil autre'
          ? 'Autre — ' + val('autreBesoinInternePrecision')
          : selText('besoinInterne'));
        var cadre = val('cadreProjet') === 'Autre'
          ? 'Autre — ' + val('autreCadrePrecision')
          : selText('cadreProjet');
        if (val('cadreProjet') === 'Projet associatif' && val('nomAssociation')) cadre += ' (' + val('nomAssociation') + ')';
        add('Cadre du projet', cadre);
      }

      add('Remarques', val('remarques'));

      var names = [];
      form.querySelectorAll('input[type=file]').forEach(function (inp) {
        if (inp.disabled) return;
        for (var i = 0; i < inp.files.length; i++) names.push(inp.files[i].name + ' (' + formatSize(inp.files[i].size) + ')');
      });
      add('Fichiers joints', names.join('\n'));

      container.querySelector('#fcs-recap').innerHTML = rows.map(function (r) {
        return '<li><b>' + esc(r[0]) + '</b><span>' + esc(r[1]) + '</span></li>';
      }).join('');
      container.querySelector('#fcs-status').textContent = '';
    }

    form.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-action]');
      if (!btn) return;
      if (btn.dataset.action === 'next') goNext();
      if (btn.dataset.action === 'prev') goPrev();
    });

    form.addEventListener('change', function (e) {
      clearError(e.target);
      refreshConditionals();

      if (e.target.matches('input[type=file]')) {
        var ul = e.target.closest('.fcs-field').querySelector('.fcs-files');
        if (ul) {
          ul.innerHTML = Array.prototype.map.call(e.target.files, function (f) {
            return '<li>' + esc(f.name) + ' — ' + formatSize(f.size) + '</li>';
          }).join('');
        }
      }
    });

    form.addEventListener('input', function (e) { clearError(e.target); });

    form.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && e.target.tagName === 'INPUT' && current !== '4') {
        e.preventDefault();
        goNext();
      }
    });

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (current !== '4') { goNext(); return; }

      if (form.elements.website && form.elements.website.value) return;

      var btn = container.querySelector('#fcs-submit');
      var status = container.querySelector('#fcs-status');
      btn.disabled = true;
      btn.textContent = 'Envoi en cours…';
      status.textContent = '';

      var data = new FormData(form);
      data.delete('website');

      fetch(API_URL, { method: 'POST', body: data })
        .then(function (res) {
          if (!res.ok) throw new Error('HTTP ' + res.status);
          root.innerHTML =
            '<div class="fcs-success">' +
            '<h3>Merci, votre demande a bien été envoyée.</h3>' +
            '<p>Nous revenons vers vous très rapidement à l\'adresse indiquée.</p>' +
            '<button type="button" class="fcs-btn" id="fcs-again">Envoyer une autre demande</button>' +
            '</div>';
          root.scrollIntoView({ behavior: 'smooth', block: 'start' });
          root.querySelector('#fcs-again').addEventListener('click', init);
        })
        .catch(function (err) {
          console.error('[FabriCS] Envoi du formulaire échoué :', err);
          status.textContent = 'Une erreur est survenue lors de l\'envoi. Veuillez réessayer ou nous écrire directement.';
          btn.disabled = false;
          btn.textContent = 'Envoyer la demande →';
        });
    });

    refreshConditionals();
    showPanel('1', true);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();