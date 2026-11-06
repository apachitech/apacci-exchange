import React from "react";

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl rounded-3xl border border-slate-200 bg-white p-6 sm:p-10 shadow-xs dark:border-slate-800 dark:bg-slate-900 space-y-6">
      <div className="space-y-2 border-b border-slate-200 dark:border-slate-800 pb-4">
        <span className="text-xs font-bold uppercase tracking-wider text-amber-600">
          Document modèle à faire réviser par un conseiller juridique
        </span>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-[#0B3D91] dark:text-white">
          Politique de Confidentialité — Apacci Exchange
        </h1>
      </div>

      <div className="space-y-4 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
        <p>
          <strong>1. Minimisation des données collectées :</strong> Apacci Exchange collecte uniquement les données strictement nécessaires à l&apos;exécution des transferts : nom complet, adresse email, numéro de téléphone de l&apos;expéditeur, et coordonnées Mobile Money du bénéficiaire.
        </p>
        <p>
          <strong>2. Masquage des numéros dans les journaux techniques :</strong> Tous les numéros de téléphone (MSISDN) sont automatiquement masqués dans nos journaux applicatifs côté serveur.
        </p>
        <p>
          <strong>3. Isolation des données (Row Level Security) :</strong> Vos bénéficiaires et votre historique de transactions sont protégés par des politiques Row Level Security (RLS) au niveau de la base de données PostgreSQL : chaque utilisateur n&apos;a accès qu&apos;à ses propres enregistrements.
        </p>
        <p>
          <strong>4. Partage avec le prestataire de paiement :</strong> Les informations nécessaires au traitement du paiement et du décaissement sont transmises de manière chiffrée (TLS) à l&apos;API SasPay.
        </p>
      </div>
    </div>
  );
}

