export namespace cliTypes {
  interface deployConfig {
    serviceInformation: any;
    name: string;
    fallbackConfigPath: string;
  }
  export function isDeployConfig(obj: any): obj is deployConfig {
    const testObj = obj as deployConfig;
    return !(
      testObj.serviceInformation == undefined ||
      testObj.name == undefined ||
      testObj.fallbackConfigPath == undefined
    );
  }
}
