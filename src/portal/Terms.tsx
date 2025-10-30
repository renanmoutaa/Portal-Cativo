import React from "react";
import { Link } from "react-router-dom";

export default function TermsPortal() {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="w-full max-w-2xl bg-white shadow-sm border rounded-xl p-6">
        <h1 className="text-xl font-semibold mb-4">Termos de Uso do Hotspot</h1>
        <div className="prose max-w-none text-sm text-slate-700 space-y-3">
          <p>
            Ao utilizar este serviço de Wi‑Fi, você concorda em não realizar
            atividades ilícitas, respeitar a privacidade de outros usuários e
            cumprir a legislação aplicável. O tráfego pode ser monitorado para
            fins de segurança e auditoria.
          </p>
          <p>
            Não coletamos dados sensíveis sem seu consentimento. Nome, e‑mail e
            telefone são utilizados exclusivamente para identificação e, quando
            autorizado, para comunicação sobre o serviço.
          </p>
          <p>
            O acesso pode ser interrompido em caso de abuso, violação dos
            termos ou manutenção da rede.
          </p>
        </div>
        <div className="mt-6 flex items-center justify-between">
          <Link to="/portal/login" className="underline text-sm">Voltar</Link>
          <Link to="/portal/login" className="bg-slate-900 text-white rounded-md px-3 py-2 text-sm">Aceito</Link>
        </div>
      </div>
    </div>
  );
}