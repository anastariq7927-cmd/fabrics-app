// src/ux/ContactForm.js

export function renderContactPage() {
  return `
    <section class="min-h-screen bg-ink text-paper font-sans">
      <div class="max-w-content mx-auto px-6 md:px-10 py-16 md:py-24">
        
        <!-- En-tête -->
        <div class="mb-12 max-w-2xl">
          <span class="font-display text-sm tracking-widest text-mist block mb-2">CONTACT & DEMANDES</span>
          <h1 class="font-display text-3xl md:text-5xl font-bold mb-4 tracking-tight">Formulaire de contact</h1>
          <p class="text-mist leading-relaxed">
            L'association de CentraleSupélec, localisée à Metz, vous accompagne dans tous vos projets de conception technique, de modélisation, d'impression.
          </p>
        </div>

        <div class="bg-slate-900/50 border border-grenade/30 rounded-lg p-6 md:p-10 shadow-xl backdrop-blur-sm">
          
          <!-- Indicator -->
          <div class="flex items-center space-x-3 mb-8 border-b border-grenade/20 pb-4">
            <div id="dot-1" class="w-2.5 h-2.5 rounded-full bg-grenade transition-all"></div>
            <span class="text-xs font-display tracking-widest text-mist uppercase">Étape <span id="step-num">1</span> / 3</span>
          </div>

          <form id="fabrics-contact-form" enctype="multipart/form-data" class="space-y-6">
            
            <!-- ÉTAPE 1 : Identification & Profil -->
            <div id="step-1" class="space-y-6">
              <div>
                <label class="block font-display text-xs tracking-wider uppercase text-paper mb-2">Qui êtes-vous ? <span class="text-grenade-light">*</span></label>
                <!-- required ajouté -->
                <select id="select-profil" name="quiEtesVous" onchange="toggleAutreProfil()" required class="w-full bg-ink border border-slate-700 text-paper px-4 py-3 text-sm focus:outline-none focus:border-grenade transition-colors">
                  <option value="">-- Sélectionnez votre profil --</option>
                  <option value="etudiant_cotisant">Étudiant de CentraleSupélec cotisant</option>
                  <option value="etudiant_non_cotisant">Étudiant de CentraleSupélec non cotisant</option>
                  <option value="personnel_interne">Personnel interne à CentraleSupélec</option>
                  <option value="entreprise_collectivite">Entreprises, collectivités, organisations ...</option>
                  <option value="autre">Autre</option>
                </select>
              </div>

              <!-- Champ de précision : Autre Profil (obligatoire uniquement si affiché) -->
              <div id="field-autre-profil" class="hidden bg-ink/80 p-4 border-l-2 border-grenade space-y-2">
                <label class="block font-display text-xs tracking-wider uppercase text-grenade-light">Veuillez préciser votre profil <span class="text-grenade-light">*</span></label>
                <input type="text" id="input-autre-profil" name="autreProfilPrecision" placeholder="Ex: Ancien élève, partenaire..." class="w-full bg-slate-900 border border-slate-700 text-paper px-4 py-2.5 text-sm focus:outline-none focus:border-grenade">
              </div>

              <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label class="block font-display text-xs tracking-wider uppercase text-paper mb-2">Adresse mail <span class="text-grenade-light">*</span></label>
                  <!-- required ajouté -->
                  <input type="email" id="input-email" name="email" required placeholder="nom@exemple.com" class="w-full bg-ink border border-slate-700 text-paper px-4 py-3 text-sm focus:outline-none focus:border-grenade">
                </div>
                <div>
                  <label class="block font-display text-xs tracking-wider uppercase text-paper mb-2">Numéro de téléphone</label>
                  <input type="tel" name="telephone" placeholder="06 12 34 56 78" class="w-full bg-ink border border-slate-700 text-paper px-4 py-3 text-sm focus:outline-none focus:border-grenade">
                </div>
              </div>

              <div class="flex justify-end pt-4">
                <button type="button" onclick="goToStep2()" class="inline-flex items-center font-display text-xs tracking-wide border px-6 py-3 transition-colors duration-200 border-grenade text-grenade-light hover:bg-grenade hover:text-paper">
                  Suivant →
                </button>
              </div>
            </div>

            <!-- ÉTAPE 2A : Parcours Interne CS -->
            <div id="step-2-interne" class="hidden space-y-6">
              <div>
                <label class="block font-display text-xs tracking-wider uppercase text-paper mb-2">Que souhaitez vous faire ? <span class="text-grenade-light">*</span></label>
                <!-- required ajouté -->
                <select id="select-besoin-interne" name="besoinInterne" onchange="toggleAutreBesoinInterne()" required class="w-full bg-ink border border-slate-700 text-paper px-4 py-3 text-sm focus:outline-none focus:border-grenade">
                  <option value="">-- Choisir une prestation --</option>
                  <option value="Impression 3D">Impression 3D</option>
                  <option value="Gravure ou découpe laser">Gravure ou découpe laser</option>
                  <option value="Aide à la conception matérielle ou 3D">Aide à la conception matérielle ou 3D</option>
                  <option value="Service ou conseil autre">Service ou conseil autre</option>
                </select>
              </div>

              <div id="field-autre-besoin-interne" class="hidden bg-ink/80 p-4 border-l-2 border-grenade space-y-2">
                <label class="block font-display text-xs tracking-wider uppercase text-grenade-light">Précisez le service ou conseil souhaité <span class="text-grenade-light">*</span></label>
                <input type="text" id="input-autre-besoin" name="autreBesoinInternePrecision" placeholder="Décrivez succinctement votre besoin..." class="w-full bg-slate-900 border border-slate-700 text-paper px-4 py-2.5 text-sm focus:outline-none focus:border-grenade">
              </div>

              <div>
                <label class="block font-display text-xs tracking-wider uppercase text-paper mb-2">Dans quel cadre est votre projet ? <span class="text-grenade-light">*</span></label>
                <!-- required ajouté -->
                <select id="select-cadre" name="cadreProjet" onchange="toggleCadreFields()" required class="w-full bg-ink border border-slate-700 text-paper px-4 py-3 text-sm focus:outline-none focus:border-grenade">
                  <option value="">-- Choisir le cadre --</option>
                  <option value="Projet entre élèves">Projet entre élèves</option>
                  <option value="Projet académique">Projet académique</option>
                  <option value="Projet associatif">Projet associatif</option>
                  <option value="Projet personnel">Projet personnel</option>
                  <option value="Prestation externe">Prestation externe (entreprises, associations...)</option>
                  <option value="Autre">Autre</option>
                </select>
              </div>

              <div id="field-asso" class="hidden bg-ink/80 p-4 border-l-2 border-grenade space-y-2">
                <label class="block font-display text-xs tracking-wider uppercase text-grenade-light">Pour quelle association/club de CS ?</label>
                <input type="text" name="nomAssociation" placeholder="Ex: BDE, FabriCS, Club Robotique..." class="w-full bg-slate-900 border border-slate-700 text-paper px-4 py-2.5 text-sm focus:outline-none focus:border-grenade">
              </div>

              <div id="field-autre-cadre" class="hidden bg-ink/80 p-4 border-l-2 border-grenade space-y-2">
                <label class="block font-display text-xs tracking-wider uppercase text-grenade-light">Précisez le cadre de votre projet <span class="text-grenade-light">*</span></label>
                <input type="text" id="input-autre-cadre" name="autreCadrePrecision" placeholder="Précisez le contexte..." class="w-full bg-slate-900 border border-slate-700 text-paper px-4 py-2.5 text-sm focus:outline-none focus:border-grenade">
              </div>

              <div class="flex justify-between pt-4">
                <button type="button" onclick="goToStep1()" class="inline-flex items-center font-display text-xs tracking-wide border px-6 py-3 transition-colors duration-200 border-slate-700 text-mist hover:text-paper hover:border-paper">
                  ← Retour
                </button>
                <button type="button" onclick="goToStep3()" class="inline-flex items-center font-display text-xs tracking-wide border px-6 py-3 transition-colors duration-200 border-grenade text-grenade-light hover:bg-grenade hover:text-paper">
                  Suivant →
                </button>
              </div>
            </div>

            <!-- ÉTAPE 2B : Parcours Entreprises -->
            <div id="step-2-entreprise" class="hidden space-y-6">
              <div>
                <label class="block font-display text-xs tracking-wider uppercase text-paper mb-2">Que souhaitez vous faire ? <span class="text-grenade-light">*</span></label>
                <!-- required ajouté -->
                <select id="select-besoin-entreprise" name="besoinEntreprise" onchange="toggleAutreEntreprise()" required class="w-full bg-ink border border-slate-700 text-paper px-4 py-3 text-sm focus:outline-none focus:border-grenade">
                  <option value="">-- Choisir une option --</option>
                  <option value="Prestation événementielle">Prestation événementielle</option>
                  <option value="Prestation technique">Prestation technique (Conception matérielle ou logicielle)</option>
                  <option value="Autre demande">Autre demande</option>
                </select>
              </div>

              <div id="field-autre-entreprise" class="hidden bg-ink/80 p-4 border-l-2 border-grenade space-y-2">
                <label class="block font-display text-xs tracking-wider uppercase text-grenade-light">Précisez votre demande <span class="text-grenade-light">*</span></label>
                <input type="text" id="input-autre-entreprise" name="autreEntreprisePrecision" placeholder="Précisez la nature de votre demande..." class="w-full bg-slate-900 border border-slate-700 text-paper px-4 py-2.5 text-sm focus:outline-none focus:border-grenade">
              </div>

              <div>
                <label class="block font-display text-xs tracking-wider uppercase text-paper mb-2">Pourriez vous détailler votre proposition ? <span class="text-grenade-light">*</span></label>
                <!-- required ajouté -->
                <textarea name="detailProposition" id="textarea-detail" required rows="4" placeholder="Description de votre projet ou besoin..." class="w-full bg-ink border border-slate-700 text-paper px-4 py-3 text-sm focus:outline-none focus:border-grenade"></textarea>
              </div>

              <div class="flex justify-between pt-4">
                <button type="button" onclick="goToStep1()" class="inline-flex items-center font-display text-xs tracking-wide border px-6 py-3 transition-colors duration-200 border-slate-700 text-mist hover:text-paper hover:border-paper">
                  ← Retour
                </button>
                <button type="button" onclick="goToStep3()" class="inline-flex items-center font-display text-xs tracking-wide border px-6 py-3 transition-colors duration-200 border-grenade text-grenade-light hover:bg-grenade hover:text-paper">
                  Suivant →
                </button>
              </div>
            </div>

            <!-- ÉTAPE 3 : Pièces Jointes -->
            <div id="step-3" class="hidden space-y-6">
              <div>
                <label class="block font-display text-xs tracking-wider uppercase text-paper mb-2">Avez-vous d'autres remarques ?</label>
                <textarea name="remarques" rows="3" placeholder="Informations complémentaires, contraintes de temps..." class="w-full bg-ink border border-slate-700 text-paper px-4 py-3 text-sm focus:outline-none focus:border-grenade"></textarea>
              </div>

              <div class="space-y-4 pt-2">
                <div>
                  <label class="block font-display text-xs tracking-wider uppercase text-mist mb-2">Fichier 3D (pour impression 3D)</label>
                  <input type="file" name="fichier3d" accept=".stl,.obj,.step,.stp" class="block w-full text-xs text-mist file:mr-4 file:py-2 file:px-4 file:border file:border-grenade file:bg-transparent file:text-grenade-light hover:file:bg-grenade hover:file:text-paper cursor-pointer">
                </div>

                <div>
                  <label class="block font-display text-xs tracking-wider uppercase text-mist mb-2">Images (pour gravure laser ou autre)</label>
                  <input type="file" name="images" accept="image/*" multiple class="block w-full text-xs text-mist file:mr-4 file:py-2 file:px-4 file:border file:border-grenade file:bg-transparent file:text-grenade-light hover:file:bg-grenade hover:file:text-paper cursor-pointer">
                </div>

                <div>
                  <label class="block font-display text-xs tracking-wider uppercase text-mist mb-2">Autres documents</label>
                  <input type="file" name="autresDocuments" multiple class="block w-full text-xs text-mist file:mr-4 file:py-2 file:px-4 file:border file:border-grenade file:bg-transparent file:text-grenade-light hover:file:bg-grenade hover:file:text-paper cursor-pointer">
                </div>
              </div>

              <div class="flex justify-between pt-6 border-t border-grenade/20">
                <button type="button" onclick="goToCurrentStep2()" class="inline-flex items-center font-display text-xs tracking-wide border px-6 py-3 transition-colors duration-200 border-slate-700 text-mist hover:text-paper hover:border-paper">
                  ← Retour
                </button>
                <button type="submit" class="inline-flex items-center font-display text-xs tracking-wide border px-8 py-3 transition-colors duration-200 border-grenade bg-grenade text-paper hover:bg-grenade-light font-bold">
                  Envoyer la demande →
                </button>
              </div>
            </div>

          </form>
        </div>
      </div>
    </section>
  `;
}

// Logique du script de validation & étape
export function initContactFormScript() {
  window.goToStep2 = function() {
    const profilSelect = document.getElementById('select-profil');
    const emailInput = document.getElementById('input-email');
    const autreProfilInput = document.getElementById('input-autre-profil');

    // Vérification de l'étape 1
    if (!profilSelect.value) {
      alert('Veuillez sélectionner votre profil.');
      profilSelect.focus();
      return;
    }

    if (profilSelect.value === 'autre' && !autreProfilInput.value.trim()) {
      alert('Veuillez préciser votre profil.');
      autreProfilInput.focus();
      return;
    }

    if (!emailInput.value || !emailInput.checkValidity()) {
      alert('Veuillez saisir une adresse e-mail valide.');
      emailInput.focus();
      return;
    }

    // Passage à l'étape 2
    document.getElementById('step-1').classList.add('hidden');
    if (profilSelect.value === 'entreprise_collectivite') {
      document.getElementById('step-2-entreprise').classList.remove('hidden');
    } else {
      document.getElementById('step-2-interne').classList.remove('hidden');
    }
    document.getElementById('step-num').innerText = '2';
  };

  window.goToStep3 = function() {
    const profil = document.getElementById('select-profil').value;

    if (profil === 'entreprise_collectivite') {
      const besoinEnt = document.getElementById('select-besoin-entreprise');
      const detailProp = document.getElementById('textarea-detail');
      const autreEnt = document.getElementById('input-autre-entreprise');

      if (!besoinEnt.value) {
        alert('Veuillez indiquer ce que vous souhaitez faire.');
        besoinEnt.focus();
        return;
      }
      if (besoinEnt.value === 'Autre demande' && !autreEnt.value.trim()) {
        alert('Veuillez préciser votre demande.');
        autreEnt.focus();
        return;
      }
      if (!detailProp.value.trim()) {
        alert('Veuillez détailler votre proposition.');
        detailProp.focus();
        return;
      }

      document.getElementById('step-2-entreprise').classList.add('hidden');
    } else {
      const besoinInt = document.getElementById('select-besoin-interne');
      const cadre = document.getElementById('select-cadre');
      const autreBesoin = document.getElementById('input-autre-besoin');
      const autreCadre = document.getElementById('input-autre-cadre');

      if (!besoinInt.value) {
        alert('Veuillez indiquer ce que vous souhaitez faire.');
        besoinInt.focus();
        return;
      }
      if (besoinInt.value === 'Service ou conseil autre' && !autreBesoin.value.trim()) {
        alert('Veuillez préciser le service ou conseil souhaité.');
        autreBesoin.focus();
        return;
      }
      if (!cadre.value) {
        alert('Veuillez sélectionner le cadre de votre projet.');
        cadre.focus();
        return;
      }
      if (cadre.value === 'Autre' && !autreCadre.value.trim()) {
        alert('Veuillez préciser le cadre de votre projet.');
        autreCadre.focus();
        return;
      }

      document.getElementById('step-2-interne').classList.add('hidden');
    }

    document.getElementById('step-3').classList.remove('hidden');
    document.getElementById('step-num').innerText = '3';
  };

  window.goToStep1 = function() {
    document.getElementById('step-2-interne').classList.add('hidden');
    document.getElementById('step-2-entreprise').classList.add('hidden');
    document.getElementById('step-1').classList.remove('hidden');
    document.getElementById('step-num').innerText = '1';
  };

  window.goToCurrentStep2 = function() {
    const profil = document.getElementById('select-profil').value;
    document.getElementById('step-3').classList.add('hidden');
    if (profil === 'entreprise_collectivite') {
      document.getElementById('step-2-entreprise').classList.remove('hidden');
    } else {
      document.getElementById('step-2-interne').classList.remove('hidden');
    }
    document.getElementById('step-num').innerText = '2';
  };

  window.toggleAutreProfil = function() {
    const val = document.getElementById('select-profil').value;
    const input = document.getElementById('input-autre-profil');
    document.getElementById('field-autre-profil').classList.toggle('hidden', val !== 'autre');
    if (val === 'autre') input.setAttribute('required', 'true');
    else input.removeAttribute('required');
  };

  window.toggleAutreBesoinInterne = function() {
    const val = document.getElementById('select-besoin-interne').value;
    const input = document.getElementById('input-autre-besoin');
    document.getElementById('field-autre-besoin-interne').classList.toggle('hidden', val !== 'Service ou conseil autre');
    if (val === 'Service ou conseil autre') input.setAttribute('required', 'true');
    else input.removeAttribute('required');
  };

  window.toggleCadreFields = function() {
    const val = document.getElementById('select-cadre').value;
    const inputCadre = document.getElementById('input-autre-cadre');
    document.getElementById('field-asso').classList.toggle('hidden', val !== 'Projet associatif');
    document.getElementById('field-autre-cadre').classList.toggle('hidden', val !== 'Autre');
    if (val === 'Autre') inputCadre.setAttribute('required', 'true');
    else inputCadre.removeAttribute('required');
  };

  window.toggleAutreEntreprise = function() {
    const val = document.getElementById('select-besoin-entreprise').value;
    const input = document.getElementById('input-autre-entreprise');
    document.getElementById('field-autre-entreprise').classList.toggle('hidden', val !== 'Autre demande');
    if (val === 'Autre demande') input.setAttribute('required', 'true');
    else input.removeAttribute('required');
  };
}

