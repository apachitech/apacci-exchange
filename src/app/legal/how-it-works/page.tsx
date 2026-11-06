import React from "react";

export default function HowItWorksPage() {
  return (
    <div className="mx-auto max-w-3xl rounded-3xl border border-slate-200 bg-white p-6 sm:p-10 shadow-xs dark:border-slate-800 dark:bg-slate-900 space-y-6">
      <div className="space-y-2 border-b border-slate-200 dark:border-slate-800 pb-4">
        <span className="text-xs font-bold uppercase tracking-wider text-[#F5B700]">
          Documentation & Transparence
        </span>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-[#0B3D91] dark:text-white">
          Comment fonctionne Apacci Exchange / How Apacci Exchange works
        </h1>
      </div>

      <section className="space-y-3 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
        <h2 className="text-base font-bold text-slate-900 dark:text-white">
          1. Simulation transparente du corridor et des frais
        </h2>
        <p>
          Vous choisissez votre pays de destination (ex. Mali XOF, Tanzanie TZS, Gabon XAF, Afrique du Sud ZAR) et saisissez le montant à envoyer depuis la Côte d&apos;Ivoire (XOF). Le serveur interroge en temps réel les tarifs et taux de change de l&apos;API SasPay et affiche les frais exacts ainsi que le montant net reçu par le bénéficiaire.
        </p>

        <h2 className="text-base font-bold text-slate-900 dark:text-white">
          2. Encaissement sécurisé via SasPay
        </h2>
        <p>
          Le paiement entrant est traité via une session de paiement hébergée SasPay (Mobile Money ou Carte bancaire). Vos identifiants de paiement ne transitent jamais par les serveurs d&apos;Apacci Exchange.
        </p>

        <h2 className="text-base font-bold text-slate-900 dark:text-white">
          3. Vérification cryptographique avant décaissement
        </h2>
        <p>
          Apacci Exchange ne se fie jamais à une simple redirection navigateur. Dès réception du webhook signé HMAC-SHA256 de SasPay, notre serveur vérifie l&apos;état réel auprès du gateway via <code>GET /payments/&#123;id&#125;/verify/</code> avant de marquer la transaction comme payée (<code>paid</code>).
        </p>

        <h2 className="text-base font-bold text-slate-900 dark:text-white">
          4. Envoi Mobile Money au bénéficiaire (Payout)
        </h2>
        <p>
          Une fois le paiement confirmé, un verrou atomique en base de données déclenche un unique appel de décaissement (<code>POST /payouts/initialize/</code>) muni d&apos;une clé d&apos;idempotence (<code>Idempotency-Key</code>) vers le numéro Mobile Money du bénéficiaire.
        </p>

        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-200 mt-4">
          <strong>Avertissement juridique (Modèle à valider par un avocat) :</strong>{" "}
          Apacci Exchange est une interface technologique s&apos;appuyant sur l&apos;API de paiement SasPay. Apacci Exchange n&apos;est ni une banque, ni un établissement de monnaie électronique ou de paiement agréé.
        </div>
      </section>
    </div>
  );
}

