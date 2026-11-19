const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const XLSX = require('xlsx');

// 1. Dossiers de stockage (créés automatiquement s'ils n'existent pas)
const uploadsDir = path.join(__dirname, '../../uploads');
const dataDir = path.join(__dirname, '../../data');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const EXCEL_FILE_PATH = path.join(dataDir, 'suivi_demandes.xlsx');

// 2. Configuration Multer (corrige l'erreur "Too many files")
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`)
});

const upload = multer({
  storage,
  limits: {
    fileSize: 25 * 1024 * 1024, // 25 Mo max par fichier
    files: 20                   // Jusqu'à 20 fichiers au total
  }
});

// 3. Route de réception du formulaire (/api/contact)
router.post('/', upload.fields([
  { name: 'fichier3d', maxCount: 5 },
  { name: 'images', maxCount: 10 },
  { name: 'autresDocuments', maxCount: 10 }
]), (req, res) => {
  try {
    const data = req.body || {};
    const files = req.files || {};

    // Affichage dans le terminal
    console.log('\n=========================================');
    console.log('📩 NOUVELLE DEMANDE :', new Date().toLocaleString('fr-FR'));
    console.log('Données :', data);
    console.log('Fichiers :', {
      fichier3d: files.fichier3d ? files.fichier3d.map(f => f.originalname) : [],
      images: files.images ? files.images.map(f => f.originalname) : [],
      autresDocuments: files.autresDocuments ? files.autresDocuments.map(f => f.originalname) : []
    });
    console.log('=========================================\n');

    // Préparation de la ligne Excel
    const nouvelleLigne = {
      Date: new Date().toLocaleString('fr-FR'),
      Profil: data.quiEtesVous || '',
      Precision_Profil: data.autreProfilPrecision || '',
      Email: data.email || '',
      Telephone: data.telephone || '',
      Prestation_Interne: data.besoinInterne || '',
      Precision_Prestation: data.autreBesoinInternePrecision || '',
      Cadre_Projet: data.cadreProjet || '',
      Association: data.nomAssociation || '',
      Precision_Cadre: data.autreCadrePrecision || '',
      Besoin_Entreprise: data.besoinEntreprise || '',
      Precision_Entreprise: data.autreEntreprisePrecision || '',
      Detail_Proposition: data.detailProposition || '',
      Remarques: data.remarques || '',
      Fichier_3D: files.fichier3d ? files.fichier3d[0].filename : 'Aucun',
      Images: files.images ? files.images.map(f => f.filename).join(', ') : 'Aucune',
      Autres_Docs: files.autresDocuments ? files.autresDocuments.map(f => f.filename).join(', ') : 'Aucun'
    };

    // Lecture ou création du classeur Excel
    let workbook;
    let lignesExistantes = [];

    if (fs.existsSync(EXCEL_FILE_PATH)) {
      workbook = XLSX.readFile(EXCEL_FILE_PATH);
      const sheetName = workbook.SheetNames[0];
      lignesExistantes = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);
    } else {
      workbook = XLSX.utils.book_new();
    }

    lignesExistantes.push(nouvelleLigne);
    const nouvelleFeuille = XLSX.utils.json_to_sheet(lignesExistantes);

    if (workbook.SheetNames.length > 0) {
      workbook.Sheets[workbook.SheetNames[0]] = nouvelleFeuille;
    } else {
      XLSX.utils.book_append_sheet(workbook, nouvelleFeuille, 'Demandes');
    }

    XLSX.writeFile(workbook, EXCEL_FILE_PATH);
    console.log('✅ Enregistré dans :', EXCEL_FILE_PATH);

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('❌ ERREUR SERVEUR :', err);
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;