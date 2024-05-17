async function main() {
    console.log("Iniciando Pyodide...");

    let pyodide = await loadPyodide({
        indexURL: "https://cdn.jsdelivr.net/pyodide/v0.21.3/full/"
    });
    console.log("Pyodide carregado.");

    await pyodide.loadPackage(["pandas", "numpy"]);
    console.log("Bibliotecas pandas e numpy carregadas.");

    // Carregar o arquivo CSV usando PapaParse
    Papa.parse("cotasRioNegro.csv", {
        download: true,
        header: true,
        complete: async function(results) {
            console.log("CSV carregado:", results.data);

            // Converter os dados CSV para um DataFrame pandas
            let csvData = JSON.stringify(results.data);
            const pythonCode = `
import pandas as pd
import numpy as np

# Carregar os dados CSV a partir do JavaScript
csv_data = '''${csvData}'''
df = pd.read_json(csv_data)

# Converter a coluna 'dias' para o formato datetime
df['dias'] = pd.to_datetime(df['dias'])

# Extrair ano, mês, dia e mês-dia da coluna 'dias'
df['ano'] = df['dias'].dt.year
df['mes'] = df['dias'].dt.month
df['dia'] = df['dias'].dt.day
df['mes_dia'] = df['dias'].dt.strftime('%m-%d')

# Adicionar uma coluna 'data' para garantir a interpretação correta das datas
df['data'] = pd.to_datetime('2000-' + df['mes_dia'], format='%Y-%m-%d')

# Pivotar o DataFrame para ter os anos como colunas e dias/meses como índices
df_pivot = df.pivot(index=['mes', 'dia', 'data'], columns='ano', values='cota').reset_index()

# Encontrar o índice da última linha com um valor numérico na última coluna
ultima_linha_numerica = df_pivot.iloc[:, -1].last_valid_index()

# Substituir NaN pelo valor correspondente da linha anterior
df_pivot.fillna(method='ffill', inplace=True)

# Substituir valores subsequentes por NaN na última coluna
if ultima_linha_numerica is not None:
    df_pivot.iloc[ultima_linha_numerica + 1:, -1] = np.nan

# Adicionar colunas para média, mediana, CI e CIS
df_pivot['Mean'] = df_pivot.iloc[:, 3:].mean(axis=1)
df_pivot['Median'] = df_pivot.iloc[:, 3:-1].median(axis=1)

# Definição das cotas de inundação e seca para o Rio Negro em Manaus:
df_pivot['CIS'] = 29  # Cota de Inundação Severa: 29 metros - nível em que a inundação é considerada severa.
df_pivot['CI'] = 27.5  # Cota de Inundação: 27,5 metros - nível em que o rio começa a causar problemas significativos.
df_pivot['AC'] = 27  # Atenção Crítica: 27 metros - nível de alerta para medidas preventivas devido ao risco de inundação.
df_pivot['S'] = 15.8  # Seca: 15,8 metros - nível de água considerado baixo, caracterizando uma condição de seca.
df_pivot['SS'] = 14.23  # Seca Severa: 14,23 metros - nível extremamente baixo, caracterizando uma seca severa.

# Converter o DataFrame para JSON
df_pivot_json = df_pivot.to_json(orient='split')

df_pivot_json
`;

            console.log("Executando código Python...");

            let df_pivot_json = await pyodide.runPythonAsync(pythonCode);

            console.log("Dados obtidos do Python:", df_pivot_json);

            let df_pivot = JSON.parse(df_pivot_json);

            let traces = [];
            const LINE_THICKNESS = 2;
            const FONT_SIZE = 18;

            df_pivot.columns.slice(3).forEach((col, i) => {
                let trace = {
                    x: df_pivot.data.map(row => row[2]), // coluna 'data'
                    y: df_pivot.data.map(row => row[3 + i]), // cada coluna de ano
                    mode: 'lines',
                    name: col,
                    visible: 'legendonly',
                    line: { width: LINE_THICKNESS },
                    hovertemplate: '%{y}m'
                };
                traces.push(trace);
            });

            let layout = {
                paper_bgcolor: "white",
                plot_bgcolor: "white",
                title: 'Variação do Nível da Água do Rio Negro ao Longo do Ano',
                title_x: 0.5,
                xaxis: {
                    title: "Época do Ano",
                    gridcolor: 'lightgray',
                    tickfont: { size: FONT_SIZE },
                    titlefont: { size: FONT_SIZE },
                    mirror: true,
                    ticks: 'outside',
                    tickformat: '%d %b',
                    showline: true,
                    linewidth: 1,
                    linecolor: 'black',
                    minor: {
                        ticks: "inside",
                        showgrid: true
                    }
                },
                yaxis: {
                    title: "Nível (m)",
                    gridcolor: 'lightgray',
                    tickfont: { size: FONT_SIZE },
                    titlefont: { size: FONT_SIZE },
                    mirror: true,
                    ticks: 'outside',
                    tickson: "boundaries",
                    dtick: 1,
                    showline: true,
                    linewidth: 1,
                    linecolor: 'black',
                    minor: {
                        ticks: "inside",
                        showgrid: true
                    }
                },
                font: { size: FONT_SIZE },
                showlegend: true,
                hovermode: 'x unified'
            };

            Plotly.newPlot('graph', traces, layout);
            console.log("Gráfico renderizado.");
        },
        error: function(err) {
            console.error("Erro ao carregar CSV:", err);
        }
    });
}

main().catch((error) => {
    console.error("Erro durante a execução:", error);
});
