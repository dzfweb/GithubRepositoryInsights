const axios = require("axios");
const fs = require("fs");
const { parse } = require("json2csv").Parser;
require("dotenv").config();

const cliProgress = require("cli-progress");

async function getLastCommitDate(owner, repository, accessToken) {
  const headers = {
    Authorization: `Bearer ${accessToken}`,
    Accept: "application/vnd.github.v3+json",
  };

  try {
    const response = await axios.get(
      `https://api.github.com/repos/${owner}/${repository}/commits`,
      { headers }
    );
    const lastCommitDate = response.data[0]?.commit?.committer?.date || "N/A";

    return lastCommitDate;
  } catch (error) {
    console.error(
      `Error occurred while retrieving last commit date for repository '${repository}': ${error.message}`
    );
    return "N/A";
  }
}

// Function to retrieve the total lines of code, last commit date, and language in a repository
async function getRepositoryDetails(owner, repo, accessToken, progressBar) {
  try {
    const options = {
      headers: {
        Authorization: `token ${accessToken}`,
      },
    };

    const response = await axios.get(
      `https://api.github.com/repos/${owner}/${repo}`,
      options
    );
    const { data } = response;
    const linesOfCode = data.size;

    const lastCommitDate = await getLastCommitDate(owner, repo, accessToken);

    const language = data.language;
    console.log(`Total lines of code in ${owner}/${repo}: ${linesOfCode}`);
    console.log(`Last commit date in ${owner}/${repo}: ${lastCommitDate}`);
    console.log(`Language in ${owner}/${repo}: ${language}`);
    progressBar.increment();
    return {
      repository: `${owner}/${repo}`,
      totalLines: linesOfCode,
      lastCommitDate,
      language,
    };
  } catch (error) {
    console.error(
      `Error occurred while retrieving details for ${owner}/${repo}: ${error.message}`
    );
    progressBar.increment();
    return {
      repository: `${owner}/${repo}`,
      totalLines: 0,
      lastCommitDate: "",
      language: "",
    };
  }
}

// Function to retrieve the total lines of code, last commit date, and language in all repositories of an organization
async function getRepositoryDetailsForOrganization(
  organization,
  accessToken,
  outputFile
) {
  try {
    const options = {
      headers: {
        Authorization: `token ${accessToken}`,
      },
    };

    const repositories = [];
    let page = 1;
    let response;

    const progressBar = new cliProgress.SingleBar({
      format: "Progress |{bar}| {percentage}% | {value}/{total} Repositories",
      barCompleteChar: "\u2588",
      barIncompleteChar: "\u2591",
      hideCursor: true,
    });

    progressBar.start();

    do {
      response = await axios.get(
        `https://api.github.com/orgs/${organization}/repos?page=${page}&per_page=100`,
        options
      );
      repositories.push(...response.data);
      page++;
    } while (
      response.headers.link &&
      response.headers.link.includes('rel="next"')
    );

    progressBar.setTotal(repositories.length);

    const results = [];

    for (const repo of repositories) {
      const { repository, totalLines, lastCommitDate, language } =
        await getRepositoryDetails(
          repo.owner.login,
          repo.name,
          accessToken,
          progressBar
        );
      results.push({ repository, totalLines, lastCommitDate, language });
    }

    progressBar.stop();

    console.log(`Retrieved details for all repositories of ${organization}`);

    if (outputFile.endsWith(".csv")) {
      const csvFields = [
        "repository",
        "totalLines",
        "lastCommitDate",
        "language",
      ];
      const csv = json2csvParser.parse(results, csvFields);
      fs.writeFileSync(outputFile, csv, "utf-8");
      console.log(`Results saved to ${outputFile}`);
    } else if (outputFile.endsWith(".html")) {
      generateStaticHTML(results, outputFile);
      console.log(`Results saved to ${outputFile}`);
    } else {
      console.log(
        "Invalid output file format. Please provide a file with .csv or .html extension."
      );
    }
  } catch (error) {
    console.error(
      `Error occurred while retrieving organization repositories: ${error.message}`
    );
  }
}

// Function to generate static HTML file with table, summary, and charts
function generateStaticHTML(results, outputFile) {
  const tableRows = results
    .map(
      ({ repository, totalLines, lastCommitDate, language }) =>
        `<tr><td>${repository}</td><td>${totalLines}</td><td>${lastCommitDate}</td><td>${language}</td></tr>`
    )
    .join("");

  const summary = {
    totalRepositories: results.length,
    totalLinesOfCode: results.reduce(
      (sum, { totalLines }) => sum + totalLines,
      0
    ),
  };

  const languagesData = countLanguagesData(results);
  const commitDateData = countCommitDateData(results);

  const languagesTableRows = languagesData.labels
    .map(
      (label, index) => `
      <tr>
        <td>${label}</td>
        <td>${languagesData.data[index]}</td>
        <td style="background-color: ${languagesData.colors[index]};"></td>
      </tr>
    `
    )
    .join("");

  const commitDateTableRows = commitDateData.labels
    .map(
      (label, index) => `
      <tr>
        <td>${label}</td>
        <td>${commitDateData.data[index]}</td>
        <td style="background-color: ${commitDateData.colors[index]};"></td>
      </tr>
    `
    )
    .join("");

  const html = `
      <html>
        <head>
          <script src="https://code.jquery.com/jquery-3.6.0.min.js"></script>
          <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
          <script src="https://cdn.datatables.net/1.11.3/js/jquery.dataTables.min.js"></script>
          <link rel="stylesheet" href="https://cdn.datatables.net/1.11.3/css/jquery.dataTables.min.css">
          <style>
            body {
                font-family: Tahoma, Verdana, Segoe, sans-serif;
            }
            .chart-container {
              width: 400px;
              margin-top: 20px;
            }
          </style>
        </head>
        <body>
          <table id="repositoriesTable">
            <thead>
              <tr>
                <th>Repository</th>
                <th>Total Lines</th>
                <th>Last Commit Date</th>
                <th>Language</th>
              </tr>
            </thead>
            <tbody>
              ${tableRows}
            </tbody>
            <tfoot>
              <tr>
                <td colspan="4">Summary</td>
              </tr>
              <tr>
                <td>Total Repositories: ${summary.totalRepositories}</td>
                <td>Total Lines of Code: ${summary.totalLinesOfCode}</td>
                <td colspan="2"></td>
              </tr>
            </tfoot>
          </table>
  
          <div class="chart-container">
            <canvas id="languagesChart"></canvas>
          </div>
  
          <div class="chart-container">
            <canvas id="commitDateChart"></canvas>
          </div>
          
  
          <script>
            // Chart configuration for languages chart
            var languagesChartConfig = {
              type: 'pie',
              data: {
                labels: ${JSON.stringify(languagesData.labels)},
                datasets: [{
                  data: ${JSON.stringify(languagesData.data)},
                  backgroundColor: ${JSON.stringify(languagesData.colors)}
                }]
              },
              options: {
                responsive: true,
                plugins: {
                  legend: {
                    position: 'right'
                  },
                  title: {
                    display: true,
                    text: 'Distribution of Languages'
                  }
                }
              }
            };
  
            // Chart configuration for commit date chart
            var commitDateChartConfig = {
              type: 'pie',
              data: {
                labels: ${JSON.stringify(commitDateData.labels)},
                datasets: [{
                  data: ${JSON.stringify(commitDateData.data)},
                  backgroundColor: ${JSON.stringify(commitDateData.colors)}
                }]
              },
              options: {
                responsive: true,
                plugins: {
                  legend: {
                    position: 'right'
                  },
                  title: {
                    display: true,
                    text: 'Distribution of Total Lines based on Last Commit Date'
                  }
                }
              }
            };
  
            // Create languages chart
            var languagesChart = new Chart(document.getElementById('languagesChart'), languagesChartConfig);
  
            // Create commit date chart
            var commitDateChart = new Chart(document.getElementById('commitDateChart'), commitDateChartConfig);
  
            // Initialize DataTables for repositories table
            $(document).ready(function() {
              $('#repositoriesTable').DataTable({
                "pageLength": 300
              });
            });
          </script>
        </body>
      </html>
    `;

  fs.writeFileSync(outputFile, html, "utf-8");
}

// Helper function to count languages data for the chart
function countLanguagesData(results) {
  const languages = {};
  results.forEach(({ language }) => {
    if (language) {
      if (!languages[language]) {
        languages[language] = 0;
      }
      languages[language]++;
    }
  });

  const labels = Object.keys(languages);
  const data = Object.values(languages);
  const colors = generateRandomColors(labels.length);

  return { labels, data, colors };
}

// Helper function to count commit date data for the chart
function countCommitDateData(results) {
  const currentDate = new Date();
  const dateRanges = {
    "Last 1 Month": { min: 0, max: 1 },
    "Last 3 Months": { min: 1, max: 3 },
    "Last 6 Months": { min: 3, max: 6 },
    "Last 12 Months": { min: 6, max: 12 },
    "More than 12 Months": { min: 12, max: Infinity },
  };

  const counts = {
    "Last 1 Month": 0,
    "Last 3 Months": 0,
    "Last 6 Months": 0,
    "Last 12 Months": 0,
    "More than 12 Months": 0,
  };

  results.forEach(({ lastCommitDate }) => {
    const commitDate = new Date(lastCommitDate);
    const diffInMonths =
      (currentDate.getFullYear() - commitDate.getFullYear()) * 12 +
      (currentDate.getMonth() - commitDate.getMonth());

    for (const range in dateRanges) {
      const { min, max } = dateRanges[range];
      if (min <= diffInMonths && diffInMonths <= max) {
        counts[range]++;
        break;
      }
    }
  });

  const labels = Object.keys(counts);
  const data = Object.values(counts);
  const colors = generateRandomColors(labels.length);

  return { labels, data, colors };
}

// Helper function to generate random colors for the charts
function generateRandomColors(count) {
  const colors = [];
  for (let i = 0; i < count; i++) {
    const color = "#" + Math.floor(Math.random() * 16777215).toString(16);
    colors.push(color);
  }
  return colors;
}

// Example usage
const organizationName = process.env.ORGANIZATION_NAME; // Replace with the name of your organization in the .env file
const accessToken = process.env.ACCESS_TOKEN; // Replace with your GitHub access token in the .env file
const outputFile = process.env.OUTPUT_FILE; // Replace with the desired output file name and extension in the .env file
getRepositoryDetailsForOrganization(organizationName, accessToken, outputFile);
