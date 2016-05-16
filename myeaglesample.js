var soap = require('soap');
/**
* There are total 4 soap consumption examples in this node program
* First three are three diffrent myeagle soap services consumption example with the three different input fromats
* 4th one is public soap service with very common input format.
**/


// var url ='http://wsf.cdyne.com/WeatherWS/Weather.asmx?wsdl';
//  var args={
//
// 	ModelCRUDRequest:{
// 		ModelCRUD:{
// 			serviceType:"WTC_EmployeeSkills_Read",
// 			TableName:"WTC_EmployeeSkills",
// 			RecordID:0,
// 			Filter:"",
// 			Action:"Read",
//             DataRow:{
//                 'field':{
//                     attributes:{column:"WTC_EmployeeSkills_ID"},
//                     val:'1000025'
//                 }
//             }
// 		},
// 		ADLoginRequest:{
// 			user:'WTCAdmin',
// 			pass:'WTCAdmin',
// 			lang:'192',
// 			ClientID:11,
// 			RoleID:102,
// 			OrgID:1000001,
// 			WarehouseID:1000000,
//             stage:0
// 		}
//    }
// };

var args={

ModelCRUDRequest:{
  ModelCRUD:{
    serviceType:"CreateInterest",
    TableName:"WTC_EmployeeInterest",
    RecordID:0,
    Filter:"",
    Action:"Create",
          DataRow:{
              'field':[{
                  attributes:{column:"C_BPartner_ID"},
                  val:'1001047'
              },{
                attributes:{column:"Interest"},
                val:'Cooking'
              }]
          }
  },
  ADLoginRequest:{
    user:'WTCAdmin',
    pass:'WTCAdmin',
    lang:'192',
    ClientID:11,
    RoleID:102,
    OrgID:1000001,
    WarehouseID:1000000,
          stage:0
  }
 }
};

var wsdlOptions = {
 "overrideRootElement": {
   "namespace": "xmlns:tns",
   "xmlnsAttributes": [{
     "name": "xmlns:adin",
     "value": "http://3e.pl/ADInterface"
   }]
 }
};








// My Eagle WebSercie getCustomers which has direct parts in the input
   soap.createClient("http://myeaglest.walkingtree.in/WebServices/services/WebService?wsdl",function(err, client) {

      client.WebService.WebServiceHttpPort.getCustomers({in0:1,in1:2,in2:3},function(err,result,body){
        console.log('============');
             console.log("get customers :",result.body);
         });
},'http://myeaglest.walkingtree.in/WebServices/services/WebService');

// My Eagle ADService isLOggedIn a service which does not need any inputs
console.log('============');
   soap.createClient("http://myeaglest.walkingtree.in/WebServices/services/ADService?wsdl",function(err, client) {
     client.ADService.ADServiceHttpPort.isLoggedIn(null,function(err,result,body){
             console.log('============');
             console.log("is logged in :  ",body);
       });
   },'http://myeaglest.walkingtree.in/WebServices/services/ADService');
console.log('============');

// My Eagle ModelADService createData a service which has complexType ModelCRUDRequest as child of input
// ignoredNamespaces in options with override true is mandatory when we are calling this type of request to append the namespace alias tns for every element in the complex type
   soap.createClient("http://myeaglest.walkingtree.in/WebServices/services/ModelADService?wsdl",{
     ignoredNamespaces: {
       namespaces: ['adin'],
       override: true
     }
   },function(err, client) {
     client.ModelADService.ModelADServiceHttpPort.createData(args,function(err, result,body) {
       console.log('============');
     console.log("create data :",body);
   },{
     ignoredNamespaces:['adin']
   });
   },'http://myeaglest.walkingtree.in/WebServices/services/ModelADService');
console.log('============');


// Example for public soap service with common input types . This example indicates that the common scenarios were not breaked.

   soap.createClient("http://wsf.cdyne.com/WeatherWS/Weather.asmx?wsdl",function(err, client) {
     client.Weather.WeatherSoap.GetCityWeatherByZIP({ZIP:'29135'},function(err,result,body){
console.log('============');
       console.log("weather :",body);
       });
   },'http://wsf.cdyne.com/WeatherWS/Weather.asmx');
