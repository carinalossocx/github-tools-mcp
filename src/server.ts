import Anthropic from "@anthropic-ai/sdk";
import { Octokit } from "@octokit/rest";
import dotenv from "dotenv";

dotenv.config();

const client = new Anthropic();
const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN,
});

const tools: Anthropic.Tool[] = [
  {
    name: "buscar_repositorios",
    description: "Busca repositórios no GitHub do usuário ou organização",
    input_schema: {
      type: "object" as const,
      properties: {
        query: {
          type: "string",
          description: "Termo de busca (ex: 'auth', 'api', 'cli')",
        },
        username: {
          type: "string",
          description: "Nome do usuário ou organização (opcional)",
        },
        limite: {
          type: "number",
          description: "Número máximo de resultados (padrão: 10)",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "listar_actions",
    description: "Lista as GitHub Actions disponíveis em um repositório",
    input_schema: {
      type: "object" as const,
      properties: {
        owner: {
          type: "string",
          description: "Proprietário do repositório",
        },
        repo: {
          type: "string",
          description: "Nome do repositório",
        },
      },
      required: ["owner", "repo"],
    },
  },
  {
    name: "obter_conteudo_arquivo",
    description: "Obtém o conteúdo de um arquivo específico no repositório",
    input_schema: {
      type: "object" as const,
      properties: {
        owner: {
          type: "string",
          description: "Proprietário do repositório",
        },
        repo: {
          type: "string",
          description: "Nome do repositório",
        },
        caminho: {
          type: "string",
          description: "Caminho do arquivo (ex: 'package.json')",
        },
      },
      required: ["owner", "repo", "caminho"],
    },
  },
  {
    name: "buscar_ferramentas_topico",
    description: "Busca ferramentas e bibliotecas com um tópico específico",
    input_schema: {
      type: "object" as const,
      properties: {
        topico: {
          type: "string",
          description: "Tópico a buscar (ex: 'typescript', 'testing', 'cli')",
        },
        linguagem: {
          type: "string",
          description: "Linguagem de programação (opcional)",
        },
        limite: {
          type: "number",
          description: "Número máximo de resultados (padrão: 10)",
        },
      },
      required: ["topico"],
    },
  },
  {
    name: "obter_informacoes_repositorio",
    description: "Obtém informações completas sobre um repositório",
    input_schema: {
      type: "object" as const,
      properties: {
        owner: {
          type: "string",
          description: "Proprietário do repositório",
        },
        repo: {
          type: "string",
          description: "Nome do repositório",
        },
      },
      required: ["owner", "repo"],
    },
  },
  {
    name: "listar_releases",
    description: "Lista as releases e versões disponíveis de um repositório",
    input_schema: {
      type: "object" as const,
      properties: {
        owner: {
          type: "string",
          description: "Proprietário do repositório",
        },
        repo: {
          type: "string",
          description: "Nome do repositório",
        },
        limite: {
          type: "number",
          description: "Número máximo de releases (padrão: 5)",
        },
      },
      required: ["owner", "repo"],
    },
  },
];

async function buscarRepositorios(
  query: string,
  username?: string,
  limite: number = 10
) {
  try {
    const busca = username ? `${query} user:${username}` : query;
    const resultado = await octokit.search.repos({
      q: busca,
      per_page: limite,
      sort: "stars",
      order: "desc",
    });
    return resultado.data.items.map((repo) => ({
      nome: repo.name,
      owner: repo.owner?.login,
      url: repo.html_url,
      descricao: repo.description,
      stars: repo.stargazers_count,
      linguagem: repo.language,
      topicos: repo.topics,
    }));
  } catch (erro) {
    return { erro: `Erro ao buscar repositórios: ${erro}` };
  }
}

async function listarActions(owner: string, repo: string) {
  try {
    const resultado = await octokit.repos.getContent({
      owner,
      repo,
      path: ".github/workflows",
    });

    if (Array.isArray(resultado.data)) {
      return resultado.data.map((file: any) => ({
        nome: file.name,
        caminho: file.path,
        url: file.html_url,
      }));
    }
    return [];
  } catch (erro) {
    return { erro: `Nenhuma ação encontrada ou erro ao acessar: ${erro}` };
  }
}

async function obterConteudoArquivo(
  owner: string,
  repo: string,
  caminho: string
) {
  try {
    const resultado = await octokit.repos.getContent({
      owner,
      repo,
      path: caminho,
    });

    if ("content" in resultado.data) {
      const conteudo = Buffer.from(
        resultado.data.content,
        "base64"
      ).toString("utf-8");
      return {
        caminho: resultado.data.path,
        conteudo,
        url: resultado.data.html_url,
      };
    }
    return { erro: "Arquivo não encontrado ou é um diretório" };
  } catch (erro) {
    return { erro: `Erro ao obter arquivo: ${erro}` };
  }
}

async function buscarFerramentasTopico(
  topico: string,
  linguagem?: string,
  limite: number = 10
) {
  try {
    let busca = `topic:${topico}`;
    if (linguagem) {
      busca += ` language:${linguagem}`;
    }
    const resultado = await octokit.search.repos({
      q: busca,
      per_page: limite,
      sort: "stars",
      order: "desc",
    });
    return resultado.data.items.map((repo) => ({
      nome: repo.name,
      owner: repo.owner?.login,
      url: repo.html_url,
      descricao: repo.description,
      stars: repo.stargazers_count,
      linguagem: repo.language,
    }));
  } catch (erro) {
    return { erro: `Erro ao buscar ferramentas: ${erro}` };
  }
}

async function obterInformacoesRepositorio(owner: string, repo: string) {
  try {
    const resultado = await octokit.repos.get({ owner, repo });
    return {
      nome: resultado.data.name,
      owner: resultado.data.owner?.login,
      url: resultado.data.html_url,
      descricao: resultado.data.description,
      stars: resultado.data.stargazers_count,
      forks: resultado.data.forks_count,
      linguagem: resultado.data.language,
      topicos: resultado.data.topics,
      readme: resultado.data.readme_url,
      dataAtualizacao: resultado.data.updated_at,
    };
  } catch (erro) {
    return { erro: `Erro ao obter informações: ${erro}` };
  }
}

async function listarReleases(owner: string, repo: string, limite: number = 5) {
  try {
    const resultado = await octokit.repos.listReleases({
      owner,
      repo,
      per_page: limite,
    });
    return resultado.data.map((release) => ({
      versao: release.tag_name,
      nome: release.name,
      descricao: release.body,
      dataPublicacao: release.published_at,
      url: release.html_url,
      prerelease: release.prerelease,
    }));
  } catch (erro) {
    return { erro: `Erro ao listar releases: ${erro}` };
  }
}

async function processarTool(
  toolName: string,
  toolInput: Record<string, any>
): Promise<any> {
  switch (toolName) {
    case "buscar_repositorios":
      return await buscarRepositorios(
        toolInput.query,
        toolInput.username,
        toolInput.limite
      );
    case "listar_actions":
      return await listarActions(toolInput.owner, toolInput.repo);
    case "obter_conteudo_arquivo":
      return await obterConteudoArquivo(
        toolInput.owner,
        toolInput.repo,
        toolInput.caminho
      );
    case "buscar_ferramentas_topico":
      return await buscarFerramentasTopico(
        toolInput.topico,
        toolInput.linguagem,
        toolInput.limite
      );
    case "obter_informacoes_repositorio":
      return await obterInformacoesRepositorio(toolInput.owner, toolInput.repo);
    case "listar_releases":
      return await listarReleases(
        toolInput.owner,
        toolInput.repo,
        toolInput.limite
      );
    default:
      return { erro: `Ferramenta desconhecida: ${toolName}` };
  }
}

async function chat(userMessage: string) {
  console.log(`\n💬 Você: ${userMessage}\n`);

  const messages: Anthropic.MessageParam[] = [
    {
      role: "user",
      content: userMessage,
    },
  ];

  let resposta = await client.messages.create({
    model: "claude-3-5-sonnet-20241022",
    max_tokens: 4096,
    tools,
    messages,
  });

  while (resposta.stop_reason === "tool_use") {
    const toolUseBlock = resposta.content.find(
      (block) => block.type === "tool_use"
    ) as Anthropic.ToolUseBlock | undefined;

    if (!toolUseBlock) break;

    const toolName = toolUseBlock.name;
    const toolInput = toolUseBlock.input as Record<string, any>;

    console.log(`🔧 Usando ferramenta: ${toolName}`);
    console.log(`   Input:`, JSON.stringify(toolInput, null, 2));

    const toolResult = await processarTool(toolName, toolInput);
    console.log(`   Resultado:`, JSON.stringify(toolResult, null, 2));

    messages.push({
      role: "assistant",
      content: resposta.content,
    });

    messages.push({
      role: "user",
      content: [
        {
          type: "tool_result",
          tool_use_id: toolUseBlock.id,
          content: JSON.stringify(toolResult),
        },
      ],
    });

    resposta = await client.messages.create({
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 4096,
      tools,
      messages,
    });
  }

  const textoFinal = resposta.content
    .filter((block) => block.type === "text")
    .map((block) => (block as Anthropic.TextBlock).text)
    .join("\n");

  console.log(`\n🤖 Claude: ${textoFinal}\n`);
  return textoFinal;
}

async function main() {
  console.log("🚀 GitHub Tools MCP - Iniciando servidor...");
  console.log(
    "Este servidor permite que Claude busque ferramentas no GitHub automaticamente.\n"
  );

  // Exemplos de uso
  const exemplos = [
    "Encontre as melhores ferramentas TypeScript para testes",
    "Qual é o README do repositório microsoft/vscode?",
    "Me mostre as últimas releases de nodejs/node",
  ];

  for (const exemplo of exemplos) {
    await chat(exemplo);
    console.log("---\n");
  }
}

main().catch(console.error);
