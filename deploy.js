const {deployNodeJS} = require("@azure/api-management-custom-widgets-tools")

const serviceInformation = {
	"resourceId": "subscriptions/55d8ae77-2cb9-4d2b-b3ee-1a5cb53b71e2/resourceGroups/APIMTestingRG/providers/Microsoft.ApiManagement/service/apiWidgetTest",
	"managementApiEndpoint": "https://management.azure.com"
}
const name = "ts"
const fallbackConfigPath = "./static/config.msapim.json"

deployNodeJS(serviceInformation, name, fallbackConfigPath)
