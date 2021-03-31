import { exec as execImpl, ExecOptions } from '@actions/exec';

export interface ExecResult {
  code: number;
  stdout: string;
  stderr: string;
}

export const exec = async (
  commandLine: string,
  args?: string[],
  options?: ExecOptions
): Promise<ExecResult> => {
  options = options || {};
  let stdout = '';
  let stderr = '';
  options.listeners = {
    stdout: (data: Buffer) => (stdout += data.toString()),
    stderr: (data: Buffer) => (stderr += data.toString())
  };
  const code = await execImpl(commandLine, args, options);
  return { code, stdout, stderr };
};
