const axios = require("axios");
const fs = require("fs");
const { parse } = require("json2csv").Parser;
require("dotenv").config();

const cliProgress = require("cli-progress");

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
    const lastCommitDate = data.updated_at;
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
      const json2csvParser = new parse({ fields: csvFields });
      const csv = json2csvParser.parse(results);
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

// Function to generate static HTML file with table and summary
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

  const html = `
    <html>
      <head>
        <style>
          table {
            border-collapse: collapse;
            width: 100%;
          }
          th, td {
            padding: 8px;
            text-align: left;
            border-bottom: 1px solid #ddd;
          }
          tfoot td {
            font-weight: bold;
          }
        </style>
      </head>
      <body>
        <table>
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
      </body>
    </html>
  `;

  fs.writeFileSync(outputFile, html, "utf-8");
}

// Example usage
const organizationName = process.env.ORGANIZATION_NAME; // Replace with the name of your organization in the .env file
const accessToken = process.env.ACCESS_TOKEN; // Replace with your GitHub access token in the .env file
const outputFile = process.env.OUTPUT_FILE; // Replace with the desired output file name and extension in the .env file
getRepositoryDetailsForOrganization(organizationName, accessToken, outputFile);
