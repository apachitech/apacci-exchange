import React from "react";

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-3xl rounded-3xl border border-slate-200 bg-white p-6 sm:p-10 shadow-xs dark:border-slate-800 dark:bg-slate-900 space-y-6">
      <div className="space-y-2 border-b border-slate-200 dark:border-slate-800 pb-4">
        <span className="text-xs font-bold uppercase tracking-wider text-amber-600">
          Document modèle à faire réviser par un conseiller juridique
        </span>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-[#0B3D91] dark:text-white">
          Conditions Générales d&apos;Utilisation — Apacci Exchange
        </h1>
      </div>

      <div className="space-y-4 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
        <p>
          <strong>1. Nature du service :</strong> Apacci Exchange fournit une application web permettant d&apos;initier des opérations d&apos;encaissement et de décaissement via le prestataire technique SasPay. Apacci Exchange n&apos;est pas une banque ni un établissement financier agréé et ne détient pas de dépôts du public.
        </p>
        <p>
          <strong>2. Limites de transaction et conformité KYC/LCB-FT :</strong> Par défaut, les comptes non vérifiés sont limités à 100 000 XOF par transaction et 500 000 XOF par mois. Tout transfert supérieur requiert la validation préalable du statut KYC de l&apos;utilisateur.
        </p>
        <p>
          <strong>3. Exactitude des coordonnées du bénéficiaire :</strong> L&apos;expéditeur est seul responsable de l&apos;exactitude du numéro Mobile Money (MSISDN), du pays et de l&apos;opérateur sélectionnés pour le bénéficiaire.
        </p>
        <p>
          <strong>4. Gestion des échecs et remboursements :</strong> En cas d&apos;indisponibilité d&apos;un opérateur Mobile Money ou d&apos;échec du décaissement (statut <code>payout_failed</code>), l&apos;équipe d&apos;administration d&apos;Apacci Exchange peut relancer l&apos;opération ou procéder au remboursement.
        </p>
      </div>
    </div>
  );
}

