# ADR-013: Descoberta complementar no menu público

- Status: accepted
- Date: 2026-08-22

## Context

O feed vertical é a experiência principal do menu público, mas menus maiores também precisam de uma forma tradicional de navegação, busca e sugestões relacionadas. O conteúdo público deve continuar vindo exclusivamente da publicação ativa e do seu snapshot imutável.

## Decision

As três experiências reutilizam `PublicMenuPageResponse` e as mesmas regras de publicação e visibilidade. O endpoint paginado existente aceita o parâmetro opcional `search`, pesquisando nome, descrição e categoria no snapshot em memória. A tela carrega páginas adicionais somente quando o cliente escolhe o menu tradicional.

Produtos relacionados usam um endpoint público separado, mas a mesma fonte de snapshot. A estratégia inicial é determinística: excluir o produto atual e qualquer item que não esteja `AVAILABLE`, priorizar a mesma categoria e ordenar por destaque, ordem de exibição e ID. A estratégia fica isolada para poder evoluir sem alterar o contrato visual.

## Consequences

- Não há segundo modelo de produto nem serviço externo de busca ou recomendação.
- A busca permanece adequada ao tamanho esperado do MVP e mantém a consistência com a publicação ativa.
- O menu tradicional pode fazer uma sequência de requests paginados quando selecionado, preservando o carregamento inicial leve do feed.
- Mudanças futuras em relevância podem substituir a estratégia de relacionados sem redesenhar a tela.
