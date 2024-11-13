import tl = require('azure-pipelines-task-lib/task');
const fs = require('fs').promises;

const findFiles = async () => {
  console.log("Valor defaultworking", tl.getInput("System.DefaultWorkingDirectory"))
  const jsonFile = tl.getPathInputRequired("jsonFile", false) || `${tl.getInput("System.DefaultWorkingDirectory")}/variables.json` || "/variables.json";
  
  let patternVariables: string[];
  if (!jsonFile.includes("*.json")) {
    patternVariables = tl.getDelimitedInput("patternVariables", "\n", false) || ["variables.json"];
  } else {
    patternVariables = [];
  }
  tl.debug(`Searching for variables json: ${patternVariables.join(", ")}`);

  if (patternVariables.length === 0) {
    return [jsonFile];
  }

  return tl.findMatch(jsonFile, patternVariables);
}

const getVariables = async (filePath: string): Promise<any> => {
  try {
    const data = await fs.readFile(filePath, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    if (err instanceof Error) {
      tl.setResult(tl.TaskResult.Failed, `Failed to read or parse the file: ${err.message}`);
    } else {
      tl.setResult(tl.TaskResult.Failed, 'Failed to read or parse the file: Unknown error');
    }
    throw err;
  }
}

const flattenObject = (obj: any, parentKey = '', res: any = {}) => {
  for (let key in obj) {
    const propName = parentKey ? `${parentKey}.${key}` : key;
    if (typeof obj[key] === 'object') {
      // for object and array
      flattenObject(obj[key], propName, res);
    } else {
      res[propName] = obj[key];
    }
  }
  return res;
};

async function run() {
  try {
    const variablePrefix: string = tl.getInput("variablePrefix", false) || "";
    const variableFiles:string[] = await findFiles();
    console.log(`[##info] Setting variables:`);
    await Promise.all(variableFiles.map(async (variablePath) => {
      const variables: any = await getVariables(variablePath);
      const flattenedVariables = flattenObject(variables);
      Object.keys(flattenedVariables).forEach(key => {
        let keyName: string = key;
        if (variablePrefix) { keyName = `${variablePrefix}.${key}`; }
        
        let value: string = flattenedVariables[key];
        if (typeof flattenedVariables[key] === 'boolean') {
          value = flattenedVariables[key].toString();
        }
        console.log(`[##info] ${keyName} -> ${value}`);
        tl.setVariable(keyName, value);
      });
    }));
    tl.setResult(tl.TaskResult.Succeeded);
  } catch (err) {
    if (err instanceof Error) {
      tl.setResult(tl.TaskResult.Failed, err.message);
    } else {
      tl.setResult(tl.TaskResult.Failed, String(err));
    }
  }
}

run();