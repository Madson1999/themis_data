/* ========================================================================
 * LOGIN – Multi-Tenant
 *  - Captura tenant_id dinamicamente (campo oculto, subdomínio ou padrão)
 *  - Envia X-Tenant-Id em todas as requisições
 *  - Salva tenant_id no localStorage para reutilização global
 * ===================================================================== */

document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('loginForm');
    if (!form) return;
    const elMensagem = document.getElementById('mensagem');

    const showMsg = (txt, ok = false) => {
        if (!elMensagem) return;
        elMensagem.textContent = txt || '';
        elMensagem.classList.remove('sucesso', 'erro');
        elMensagem.classList.add(ok ? 'sucesso' : 'erro');
    };

    async function resolveTenantId(email) {
        // 1) hidden
        let tenantId = (document.getElementById('tenant_id') || {}).value || '';

        // 2) subdomínio
        if (!tenantId) {
            const host = window.location.hostname; // ex: tenant.dominio.com
            const isLocal =
                host === 'localhost' ||
                host === '0.0.0.0' ||
                /^\d{1,3}(\.\d{1,3}){3}$/.test(host);
            if (!isLocal) {
                const sub = host.split('.')[0];
                if (sub && sub !== 'www') tenantId = sub;
            }
        }

        // 3) consulta pelo e-mail (sem fallback 1!)
        if (!tenantId && email) {
            try {
                const r = await fetch(`/api/auth/tenant-by-email?email=${encodeURIComponent(email)}`, {
                    headers: { 'Accept': 'application/json' },
                    credentials: 'include'
                });
                if (r.ok) {
                    const j = await r.json();
                    if (j && j.tenant_id) tenantId = String(j.tenant_id);
                }
            } catch (_) { /* silencioso */ }
        }

        return tenantId || ''; // se vazio, vamos abortar o login
    }

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const email = (document.getElementById('email') || {}).value || '';
        const senha = (document.getElementById('senha') || {}).value || '';

        elMensagem && (elMensagem.textContent = '');

        const tenantId = await resolveTenantId(email);

        if (!tenantId) {
            showMsg('Não foi possível identificar o tenant para este e-mail.', false);
            return;
        }

        try {
            const resposta = await fetch('/api/auth/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'X-Tenant-Id': tenantId
                },
                body: JSON.stringify({ email, senha }), // confirme se o back espera {senha} mesmo
                credentials: 'include'
            });

            let dados = {};
            try { dados = await resposta.json(); } catch { }

            if (resposta.ok && dados.sucesso) {
                const efetivo = String(dados.tenant_id || tenantId);
                localStorage.setItem('tenant_id', efetivo);
                window.THEMIS_TENANT_ID = efetivo;

                showMsg(dados.mensagem || 'Login realizado!', true);
                setTimeout(() => window.location.href = dados.redirect || '/menu', 600);
            } else {
                showMsg((dados && dados.mensagem) || 'Falha no login.', false);
            }
        } catch (err) {
            console.error('[LOGIN] Erro:', err);
            showMsg('Erro ao conectar ao servidor.', false);
        }
    });
});

