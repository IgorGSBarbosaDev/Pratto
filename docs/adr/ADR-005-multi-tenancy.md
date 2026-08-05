# ADR-005 — Multi-tenancy por colunas

**Status:** aceito

O isolamento será feito em schema compartilhado, com identificadores de organização e
estabelecimento nas entidades relevantes. O tenant será obtido da sessão, nunca confiado ao input
do cliente.
