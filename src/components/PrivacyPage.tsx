export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      <div className="max-w-2xl mx-auto px-6 py-16">

        {/* Header */}
        <div className="mb-12">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center">
              <span className="text-[13px] font-black text-black">D</span>
            </div>
            <span className="text-[15px] font-black uppercase tracking-widest text-white">DecoStats</span>
          </div>
          <h1 className="text-3xl font-black mb-3">Política de Privacidade</h1>
          <p className="text-sm text-white/40">Última atualização: maio de 2025</p>
        </div>

        <div className="space-y-10 text-[15px] leading-relaxed text-white/75">

          <section>
            <h2 className="text-white font-bold text-lg mb-3">1. Sobre o DecoStats</h2>
            <p>
              O DecoStats é uma plataforma de análise estatística de futebol. Utilizamos dados
              históricos de partidas para gerar insights e probabilidades que auxiliam os usuários
              na análise de jogos.
            </p>
          </section>

          <section>
            <h2 className="text-white font-bold text-lg mb-3">2. Dados coletados</h2>
            <p className="mb-3">
              O DecoStats utiliza o login com Google exclusivamente para autenticação. Ao fazer
              login, coletamos apenas as informações fornecidas pelo Google:
            </p>
            <ul className="list-disc list-inside space-y-1.5 text-white/60">
              <li>Nome completo</li>
              <li>Endereço de e-mail</li>
              <li>Foto do perfil (avatar)</li>
            </ul>
            <p className="mt-3">
              Não coletamos senhas, dados bancários, localização ou qualquer outra informação pessoal.
            </p>
          </section>

          <section>
            <h2 className="text-white font-bold text-lg mb-3">3. Como usamos seus dados</h2>
            <p className="mb-3">As informações coletadas são usadas exclusivamente para:</p>
            <ul className="list-disc list-inside space-y-1.5 text-white/60">
              <li>Identificar e autenticar o usuário na plataforma</li>
              <li>Exibir nome e foto de perfil dentro do app</li>
              <li>Controlar o acesso às funcionalidades</li>
            </ul>
          </section>

          <section>
            <h2 className="text-white font-bold text-lg mb-3">4. Compartilhamento de dados</h2>
            <p>
              Não vendemos, alugamos nem compartilhamos seus dados pessoais com terceiros para
              fins comerciais. Seus dados são armazenados de forma segura no Supabase e acessados
              apenas pela aplicação DecoStats.
            </p>
          </section>

          <section>
            <h2 className="text-white font-bold text-lg mb-3">5. Armazenamento e segurança</h2>
            <p>
              Os dados são armazenados na plataforma Supabase, que utiliza criptografia em trânsito
              (TLS) e em repouso. O acesso é protegido por autenticação OAuth 2.0 do Google.
            </p>
          </section>

          <section>
            <h2 className="text-white font-bold text-lg mb-3">6. Retenção de dados</h2>
            <p>
              Seus dados são mantidos enquanto você tiver uma conta ativa. Você pode solicitar a
              exclusão dos seus dados a qualquer momento entrando em contato pelo e-mail abaixo.
            </p>
          </section>

          <section>
            <h2 className="text-white font-bold text-lg mb-3">7. Seus direitos</h2>
            <p className="mb-3">Você tem direito a:</p>
            <ul className="list-disc list-inside space-y-1.5 text-white/60">
              <li>Acessar os dados que temos sobre você</li>
              <li>Solicitar a correção de informações incorretas</li>
              <li>Solicitar a exclusão da sua conta e dados</li>
              <li>Revogar o acesso do DecoStats à sua conta Google a qualquer momento</li>
            </ul>
          </section>

          <section>
            <h2 className="text-white font-bold text-lg mb-3">8. Cookies</h2>
            <p>
              Utilizamos apenas cookies essenciais para manter a sessão de login ativa. Não
              utilizamos cookies de rastreamento ou publicidade.
            </p>
          </section>

          <section>
            <h2 className="text-white font-bold text-lg mb-3">9. Contato</h2>
            <p>
              Para dúvidas, solicitações ou exercício dos seus direitos, entre em contato:
            </p>
            <p className="mt-2">
              <a
                href="mailto:deco260483@gmail.com"
                className="text-primary hover:underline"
              >
                deco260483@gmail.com
              </a>
            </p>
          </section>

          <section>
            <h2 className="text-white font-bold text-lg mb-3">10. Alterações nesta política</h2>
            <p>
              Podemos atualizar esta política periodicamente. Notificaremos sobre mudanças
              significativas por e-mail ou aviso dentro do app. O uso continuado após as
              alterações implica na aceitação da nova política.
            </p>
          </section>

        </div>

        <div className="mt-16 pt-8 border-t border-white/10 text-center">
          <a
            href="/"
            className="text-[11px] font-bold uppercase tracking-widest text-white/30 hover:text-white/60 transition-colors"
          >
            ← Voltar para o DecoStats
          </a>
        </div>

      </div>
    </div>
  );
}
