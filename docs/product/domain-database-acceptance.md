# Critérios de aceite — domínio e banco inicial

- User participa de organizações somente por Membership.
- Session sempre pertence a User e armazena somente o hash do token.
- Establishment pertence a exatamente uma Organization e pode possuir menus.
- Menu não pode combinar um estabelecimento com a organização de outro tenant.
- E-mail, token de sessão, membership, public ID, slug e nome de menu respeitam suas unicidades.
- Public ID do estabelecimento é estável; slug não é identidade permanente.
- Seed cria dois tenants demonstrativos e pode ser executado repetidamente sem duplicação.
- Factories reutilizáveis permitem montar tenants e relações em testes.
- Product pertence a um Menu e a uma Category do mesmo tenant por FK composta.
- Produtos usam preço decimal, ordenação transacional, status separado de disponibilidade e
  arquivamento lógico.
- Publicação cria snapshot JSON imutável, com versão sequencial e publisher pertencente ao tenant.
- O menu só expõe publicação ativa após a transação de publicação concluir.
- Repetições com a mesma chave de idempotência não criam uma nova versão.
- A API administrativa permite publicar, consultar a versão ativa e listar o histórico do menu.
- A publicação congela estabelecimento, categorias, produtos e mídias em um snapshot serializável.
- O cardápio público lê somente a publicação ativa e não expõe dados do catálogo editável.
- Produtos ocultos não aparecem no feed público; produtos temporariamente indisponíveis permanecem identificados.
- A rota pública por `publicId` não exige autenticação e rejeita configuração ambígua com múltiplos menus publicados.
- Estabelecimento inexistente, suspenso, sem publicação e snapshot inválido produzem estados públicos estáveis;
  slug antigo redireciona para o slug canônico sem alterar o `publicId`.
- QR Code administrativo deriva do link público estável e permite PNG, SVG, download e compartilhamento/fallback de cópia.
- O fluxo E2E real comprova configuração, catálogo, mídias, publicação, acesso público, analytics e dashboard.
- Migration, seed, testes de integração, lint, typecheck e build são reproduzíveis pela raiz.
