async function main() {
    console.log("Iniciando Pyodide...");

    // Inicializar Pyodide com indexURL especificado
    let pyodide = await loadPyodide({
        indexURL: "https://cdn.jsdelivr.net/pyodide/v0.18.1/full/"
    });
    console.log("Pyodide carregado.");

    // Carregar bibliotecas necessárias
    await pyodide.loadPackage(["pandas", "numpy"]);
    console.log("Bibliotecas pandas e numpy carregadas.");

    // Definir o código Python como uma string
    const pythonCode = `
import pandas as pd
import numpy as np
import plotly.graph_objects as go

print("Código Python iniciado.")

# Ler o arquivo CSV em um DataFrame
df = pd.read_csv('cotasRioNegro.csv')
print("Arquivo CSV carregado.")

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

# Preparar dados para o Plotly
traces = []

LINE_THICKNESS = 2
FONT_SIZE = 18

# Adicionar traces para cada coluna de ano
for col in df_pivot.columns[3:]:
    trace = go.Scatter(
        x=df_pivot['data'], 
        y=df_pivot[col], 
        mode='lines', 
        name=str(col),
        visible='legendonly', 
        line=dict(width=LINE_THICKNESS),
        hovertemplate='%{y}m'
    )
    traces.append(trace)

# Layout do gráfico
layout = go.Layout(
    paper_bgcolor="white",
    plot_bgcolor="white", 
    title='Variação do Nível da Água do Rio Negro ao Longo do Ano',
    title_x=0.5,
    xaxis=dict(
        title_text="Época do Ano", 
        gridcolor='lightgray',
        tickfont_size=FONT_SIZE,
        title_font_size=FONT_SIZE,
        mirror=True,
        ticks='outside',
        tickformat='%d %b',
        showline=True,
        linewidth=1, 
        linecolor='black',
        minor=dict(
            ticks="inside", 
            showgrid=True
        )),
    yaxis=dict(
        title_text="Nível (m)", 
        gridcolor='lightgray',
        tickfont_size=FONT_SIZE,
        title_font_size=FONT_SIZE,
        mirror=True,
        ticks='outside',
        tickson="boundaries",
        dtick=1,
        showline=True,
        linewidth=1, 
        linecolor='black',
        minor=dict(
            ticks="inside", 
            showgrid=True
        )),
    font=dict(size=FONT_SIZE),
    showlegend=True,
    hovermode='x unified')

# Criar a figura
fig = go.Figure(data=traces, layout=layout)
fig
print("Gráfico criado.")
`;

    console.log("Executando código Python...");

    // Executar o código Python
    await pyodide.runPythonAsync(pythonCode);

    console.log("Código Python executado.");

    // Obter o gráfico Plotly criado pelo código Python
    let fig = pyodide.globals.get('fig');

    // Verificar se o gráfico foi obtido corretamente
    console.log(fig);

    // Renderizar o gráfico na página
    Plotly.newPlot('graph', fig.data, fig.layout);
    console.log("Gráfico renderizado.");
}

// Executar a função principal
main().catch((error) => {
    console.error("Erro durante a execução:", error);
});
