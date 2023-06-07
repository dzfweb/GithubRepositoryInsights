# GitHub Repository Insights

This project retrieves statistics for all repositories in a GitHub organization. It retrieves the total lines of code, last commit date, and programming language for each repository and provides the option to save the results in a CSV file or generate a static HTML file.

## Prerequisites

- Node.js (version 12 or higher)
- GitHub access token with appropriate permissions to access the organization's repositories
- Basic knowledge of the command line interface (CLI)

## Installation

1. Clone this repository or download the project files.

2. Navigate to the project directory in your terminal.

3. Install the required dependencies by running the following command:

   ```
   npm install
   ```

4. Create a .env file in the project directory and provide the following information:

```
ORGANIZATION_NAME=your_organization_name
ACCESS_TOKEN=your_github_access_token
OUTPUT_FILE=results.csv
```

Replace your_organization_name with the name of your GitHub organization, your_github_access_token with your GitHub access token, and results.csv with the desired output file name (can be a CSV or HTML file).

## Usage

To retrieve the repository statistics and save the results, run the following command:

`npm start`

The script will start executing and display a progress bar indicating the progress. Once the process is complete, the results will be saved to the specified output file.

## Output Formats

You can choose between two output formats:

### CSV File

The results will be saved in a CSV file with columns for repository, total lines of code, last commit date, and programming language.

### HTML File

The results will be saved in a static HTML file that includes a table with the repository statistics and a summary at the bottom.

Ensure that the output file has the appropriate file extension (.csv for CSV format or .html for HTML format).

### License

This project is licensed under the MIT License.
