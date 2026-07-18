window.INTERVIEW_SETS = {
  "pre": {
    "eyebrow": "Antes da leitura",
    "title": "Entrevista de pré-leitura",
    "description": "Registre expectativas, associações espontâneas e critérios de valor considerando apenas o título e o tema geral do livro.",
    "finalPrompt": "Se eu pudesse pedir uma coisa a este livro, seria:",
    "questions": [
      {
        "id": "association",
        "prompt": "Ao ouvir o título O Custo Invisível do Olho Seco, qual ideia surge primeiro para você?",
        "options": [
          "Um problema de saúde frequentemente subestimado.",
          "Um impacto oculto sobre pessoas que trabalham intensamente com telas.",
          "Um possível custo para empresas que ainda não sabem reconhecê-lo.",
          "Uma oportunidade de aproximar saúde ocular e gestão empresarial."
        ]
      },
      {
        "id": "relevance",
        "prompt": "Antes de ler, por que esse tema poderia merecer a atenção de um líder empresarial?",
        "options": [
          "Porque pode afetar o bem-estar e a experiência cotidiana das equipes.",
          "Porque o uso intenso de telas tornou a saúde visual mais relevante.",
          "Porque problemas pouco visíveis podem gerar consequências organizacionais não percebidas.",
          "Porque líderes precisam conhecer melhor temas de saúde que atravessam o trabalho moderno."
        ]
      },
      {
        "id": "expectation",
        "prompt": "Qual seria sua principal expectativa em relação a um livro com esse título?",
        "options": [
          "Entender por que o olho seco é mais importante do que parece.",
          "Reconhecer situações reais vividas por trabalhadores e empresas.",
          "Descobrir como observar ou medir o problema com responsabilidade.",
          "Encontrar orientações práticas sem promessas clínicas ou financeiras exageradas."
        ]
      },
      {
        "id": "question",
        "prompt": "Qual dúvida você mais gostaria que o livro respondesse?",
        "options": [
          "Como diferenciar um incômodo passageiro de um problema que merece atenção?",
          "O que o trabalho em telas realmente tem a ver com os sintomas oculares?",
          "Como uma empresa pode abordar o tema sem diagnosticar ou invadir a privacidade das pessoas?",
          "Como saber se uma iniciativa trouxe benefício suficiente para continuar?"
        ]
      },
      {
        "id": "trust",
        "prompt": "Que tipo de conteúdo faria você confiar mais no livro antes de recomendá-lo?",
        "options": [
          "Explicações médicas claras, com evidências e limites bem apresentados.",
          "Histórias realistas que mostrem como o problema aparece na vida cotidiana.",
          "Exemplos empresariais que reconheçam dúvidas, custos e resultados incertos.",
          "Ferramentas práticas que possam ser avaliadas ou adaptadas por diferentes organizações."
        ]
      },
      {
        "id": "audience",
        "prompt": "Para quem você imagina que esse livro deveria ser mais útil?",
        "options": [
          "CEOs, empresários e membros de conselhos.",
          "RH, saúde ocupacional e gestores de pessoas.",
          "Lideranças de tecnologia e profissionais que trabalham intensamente com telas.",
          "Oftalmologistas e outros profissionais de saúde interessados no ambiente de trabalho."
        ]
      },
      {
        "id": "transformation",
        "prompt": "O que você esperaria estar mais preparado para fazer depois da leitura?",
        "options": [
          "Conversar sobre saúde visual com mais clareza e menos preconceitos.",
          "Reconhecer quando o tema merece atenção na rotina de uma organização.",
          "Fazer perguntas melhores antes de apoiar uma ação ou investimento.",
          "Avaliar um caminho prático de observação, cuidado ou teste dentro da empresa."
        ]
      },
      {
        "id": "recommendation",
        "prompt": "Antes de ler, o que mais despertaria sua vontade de abrir e compartilhar esse livro?",
        "options": [
          "Uma promessa clara e direta, sem exageros.",
          "A sensação de que o tema é atual e próximo da realidade das empresas.",
          "A possibilidade de aprender algo inesperado sobre saúde ocular e trabalho.",
          "A expectativa de encontrar ideias práticas que possam orientar decisões."
        ]
      }
    ]
  },
  "post": {
    "eyebrow": "Depois da leitura",
    "title": "Entrevista de pós-leitura",
    "description": "Registre o que permaneceu, o que mudou e que valor a leitura realmente entregou. Use o mesmo código da etapa anterior para comparar os dois momentos.",
    "finalPrompt": "Se eu pudesse mudar uma coisa no livro, seria:",
    "questions": [
      {
        "id": "association",
        "prompt": "Depois da leitura, qual ideia sobre o livro ficou mais forte para você?",
        "options": [
          "Olho seco é um problema de saúde mais relevante do que parece.",
          "A rotina de telas merece mais atenção à experiência visual das pessoas.",
          "Empresas precisam medir antes de concluir que existe impacto ou retorno.",
          "Saúde ocular e gestão empresarial podem dialogar sem confundir seus papéis."
        ]
      },
      {
        "id": "relevance",
        "prompt": "Após ler, como você percebe a relevância do tema para lideranças empresariais?",
        "options": [
          "Maior do que eu imaginava antes da leitura.",
          "Próxima do que eu já esperava.",
          "Importante apenas em alguns contextos ou organizações.",
          "Ainda insuficiente para entrar na agenda de uma liderança."
        ]
      },
      {
        "id": "expectation",
        "prompt": "Em qual aspecto o livro mais correspondeu às suas expectativas?",
        "options": [
          "Explicou por que o olho seco pode ser subestimado.",
          "Representou situações reconhecíveis de trabalhadores e empresas.",
          "Mostrou como observar e medir o tema com responsabilidade.",
          "Ofereceu caminhos práticos sem prometer resultados."
        ]
      },
      {
        "id": "question",
        "prompt": "Qual dúvida permaneceu mais presente depois da leitura?",
        "options": [
          "Como reconhecer quando o desconforto merece avaliação especializada?",
          "Qual é o peso real do trabalho em telas diante de outros fatores?",
          "Como uma empresa aplicaria a proposta sem invadir a esfera clínica?",
          "Como demonstrar benefício suficiente para manter uma iniciativa?"
        ]
      },
      {
        "id": "trust",
        "prompt": "O que mais fortaleceu sua confiança no livro?",
        "options": [
          "A clareza das evidências e dos limites científicos.",
          "As histórias e situações humanas apresentadas.",
          "A honestidade ao separar hipótese, operação e resultado financeiro.",
          "As ferramentas e os caminhos de aplicação prática."
        ]
      },
      {
        "id": "audience",
        "prompt": "Para qual público o livro pareceu mais útil depois da leitura?",
        "options": [
          "CEOs, empresários e membros de conselhos.",
          "RH, saúde ocupacional e gestores de pessoas.",
          "Lideranças de tecnologia e profissionais que trabalham intensamente com telas.",
          "Oftalmologistas e outros profissionais de saúde interessados no ambiente de trabalho."
        ]
      },
      {
        "id": "transformation",
        "prompt": "O que você se sente mais preparado para fazer depois da leitura?",
        "options": [
          "Conversar sobre saúde visual com mais clareza e menos preconceitos.",
          "Reconhecer quando o tema merece atenção na rotina de uma organização.",
          "Fazer perguntas melhores antes de apoiar uma ação ou investimento.",
          "Avaliar um caminho prático de observação, cuidado ou teste dentro da empresa."
        ]
      },
      {
        "id": "recommendation",
        "prompt": "O que mais influencia sua disposição de recomendar o livro a outros líderes?",
        "options": [
          "A clareza e a objetividade da mensagem.",
          "A proximidade com situações reais das empresas.",
          "O aprendizado inesperado sobre saúde ocular e trabalho.",
          "A utilidade das ideias para orientar decisões."
        ]
      }
    ]
  }
};
