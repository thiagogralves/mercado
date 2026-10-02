# Mercado

Ferramenta pessoal para acompanhar compras de supermercado: cotas mensais, compras semanais, comparação de preços entre mercados e importação por nota fiscal (NFC-e).

## O que faz

- **Cotas mensais**: estime quanto de cada alimento pretende comprar no mês
- **Saldo da cota**: ao registrar compras semanais, veja quanto já comprou e quanto falta
- **Preços e mercados**: cada compra guarda mercado + preço unitário
- **Comparativos**
  - entre mercados (mesmo produto)
  - semana a semana no mesmo mercado (alta/baixa, R$ e %)
- **Registro**
  - individual / multi-item
  - lote por texto (`nome | qtd | preço`)
  - lote via URL do QR Code da NFC-e

## Stack

- Next.js (App Router) — pronto para Vercel
- Turso (libSQL/SQLite) via `@libsql/client` + Drizzle ORM
- Localmente usa `file:local.db` se não houver credenciais Turso

## Free tier do Turso (adequado para uso pessoal)

- 100 databases
- 5 GB storage
- 500 milhões de row reads / mês
- 10 milhões de row writes / mês

Alternativas boas: **Neon** (Postgres, free mais apertado em storage) ou **Cloudflare D1** (só faz sentido se o deploy for nos Workers).

## Rodar local

```bash
npm install
cp .env.example .env.local
npm run dev
```

Abra [http://localhost:3000](http://localhost:3000). No primeiro acesso o schema é criado automaticamente.

## Deploy na Vercel

1. Crie um banco no [Turso](https://turso.tech) (ou use a integração Turso Cloud no marketplace da Vercel)
2. Defina as env vars no projeto Vercel:
   - `TURSO_DATABASE_URL`
   - `TURSO_AUTH_TOKEN`
   - `NFPARSE_API_KEY` (opcional, melhora o parse da NFC-e)
3. Deploy (`vercel` ou GitHub integration)

O schema é aplicado na primeira request (`ensureSchema`).

## PWA (instalar no celular)

O app é instalável:

1. Abra no Chrome/Safari (HTTPS na Vercel)
2. Use **Instalar Mercado** no banner, ou:
   - Android: menu → Instalar app
   - iPhone: Compartilhar → Adicionar à Tela de Início

## Câmera (Nota fiscal)

Na página **Escanear**:

- **QR Code** — abre a câmera traseira e lê o QR da NFC-e
- **Foto** — tira foto do cupom e extrai produtos/valores com OCR (português)
- **URL** — cola o link manualmente

Permita o acesso à câmera quando o navegador pedir.

## Inspiração de mercado (e o que trouxemos)

| Ferramenta | Foco | Ideia aproveitada |
|---|---|---|
| [Meu Guia de Compras](https://www.meuguiadecompras.com/) | IA lê cupom/NF e monta histórico | Importação de NFC-e + catálogo de preços |
| [iSave](https://isave.com/) / [Komparar](https://komparar.com.br/) | Comparar preços entre redes | Comparativo entre mercados |
| [Listonic](https://listonic.com/) | Lista compartilhada + orçamento | Progresso visual do que falta comprar |

Diferencial desta app: **cota mensal com saldo semanal** + **variação % semana a semana no mesmo mercado**, pensado para uso doméstico com dados seus (não depende de scrapers de redes).

## Próximas melhorias sugeridas

- Lista de compras gerada automaticamente a partir do que ainda falta na cota
- Histórico de preço por produto (gráfico)
- Matching inteligente de itens da NF por código de barras / similaridade
- Compartilhamento familiar (auth + multi-usuário)
- Export CSV / PDF da semana
- PWA / uso offline no celular
