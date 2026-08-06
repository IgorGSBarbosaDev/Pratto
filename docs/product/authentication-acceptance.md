# Aceite — autenticação administrativa

- [x] Senhas Argon2id e tokens aleatórios nunca são persistidos em claro.
- [x] Sessões aplicam limites absoluto/ocioso, renovação controlada e revogação individual/global.
- [x] Cookie seguro e CSRF assinado protegem os fluxos mutáveis.
- [x] Login não diferencia usuário, credencial ou senha inválida.
- [x] Membership e organização são revalidadas e o tenant nunca vem de um ID arbitrário.
- [x] Usuário com várias memberships recebe seleção explícita.
- [x] Recuperação responde de forma neutra, expira, é de uso único e revoga sessões.
- [x] Rate limits são persistentes e concorrentes, com trackers protegidos.
- [x] Logs e auditoria não contêm senha, token, cookie, e-mail ou IP em claro.
- [x] Frontend confirma a sessão na API e oferece estados acessíveis de erro e carregamento.
- [x] Swagger e documentação descrevem os contratos.
- [x] Nenhuma entidade, rota ou interface de Category, Product, Media ou Analytics foi iniciada.
