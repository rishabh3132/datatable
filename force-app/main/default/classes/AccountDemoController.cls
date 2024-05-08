public with sharing class AccountDemoController {
    @AuraEnabled(cacheable=true)
    public static List<Account> getAccountData() {
        return [SELECT Id, Name, Rating, Industry,AnnualRevenue, Phone, (Select Id,Name, FirstName,LastName,Title,Email,Phone, Department, LeadSource,Level__c, Languages__c,GenderIdentity,MobilePhone from Contacts) from Account];
    }
    @AuraEnabled(cacheable=true)
    public static List<String> getRequiredField(){
        Schema.SObjectType targetType = Schema.getGlobalDescribe().get('Contact');
        Map<String, Schema.SObjectField> fieldMap = targetType.getDescribe().fields.getMap();
        List<String> requiredFieldList=new List<String>();
        for (Schema.SObjectField field : fieldMap.values()) {
            Schema.DescribeFieldResult describeField = field.getDescribe();
            if (describeField.isCreateable()  && !describeField.isNillable() && !describeField.isDefaultedOnCreate()) {
                requiredFieldList.add(field.getDescribe().getName());
            }
        }
        return requiredFieldList;
    } 
}