# Entrevistas pré e pós-leitura

Microsite estático para registrar expectativas antes da leitura e percepções depois da leitura de *O Custo Invisível do Olho Seco*.

## Contrato de dados

- Não há backend, analytics, `fetch`, formulário remoto ou envio automático.
- Rascunhos e respostas concluídas usam `localStorage` no navegador.
- O código do participante permite comparação pré × pós sem exigir nome.
- O participante pode baixar TXT/JSON e apagar os dados locais.
- Não registrar nome completo nem informações individuais de saúde.

## Estrutura

- `index.html`: três telas — escolha, entrevista e resultado.
- `data.js`: conteúdo estruturado das duas entrevistas.
- `app.js`: navegação, validação, persistência e exportação.
- `styles.css`: interface responsiva e acessível.

Cada modalidade possui oito perguntas, quatro alternativas orientadoras e uma opção aberta `E. Outros: digite`.

## Executar localmente

Na raiz do projeto:

```bash
python3 -m http.server 4173 --directory landing
```

Abrir `http://127.0.0.1:4173/entrevistas/`.

## Verificação

```bash
python3 scripts/check-interview-site.py
bash scripts/check-commercial-claims.sh
```

O microsite permanece `noindex,nofollow` e não deve ser publicado sem autorização explícita e teste do artefato implantado.
