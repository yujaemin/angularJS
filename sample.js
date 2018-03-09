(function() {
    'use strict';

    angular.module('aui.core.resources').factory('commonFunctionService', commonFunctionService);

    commonFunctionService.$inject = [
        'ruleService',
        'LinkAniService',
        'RULE_INFO',
        'POLICY_TYPE',
        '$log',
        'SaveConfirmUtilService',
        '$translate',
        'DialogService',
        '$location',
        '$filter',
        'chineseWallService',
        'setResource',
        'mailDomainResource',
        'employeeResource',
        '$cookies'
    ];
    /**
     * @description 화면별 중복 함수 모음
     *
     * @author jm4341.yu
     * @param {any} ruleService
     * @param {any} LinkAniService
     * @param {any} RULE_INFO
     * @param {any} POLICY_TYPE
     * @param {any} $log
     * @param {any} SaveConfirmUtilService
     * @param {any} $translate
     * @param {any} DialogService
     * @param {any} $location
     * @param {any} $filter
     * @param {any} chineseWallService
     * @param {any} setResource
     * @param {any} mailDomainResource
     * @param {any} employeeResource
     * @param {any} $cookies
     * @returns {*} this
     *
     */
    function commonFunctionService(
        ruleService,
        LinkAniService,
        RULE_INFO,
        POLICY_TYPE,
        $log,
        SaveConfirmUtilService,
        $translate,
        DialogService,
        $location,
        $filter,
        chineseWallService,
        setResource,
        mailDomainResource,
        employeeResource,
        $cookies
    ) {
        var commonFunctionService = {};

        // common popup
        commonFunctionService.alertDialog = function(header, content) {
            return new DialogService({
                title: $translate.instant(header),
                type: 'alert',
                template: $translate.instant(content)
            }).open();
        };

        // server error common popup dialog
        commonFunctionService.popupServerError = function(error) {
            var errorCode = 'common.error_code.' + error.errorCode;

            // 2017-07-05 현재까지는 swift file upload file name size 에러(error code : 2531641) 외에는 확인된 서버 에러가 없다.
            var msg = $translate.instant(errorCode);
            var detailMsg;

            if (error.errorMessage !== undefined || error.errorMessage !== null) {
                switch (error.errorMessage) {
                    case 'File IO Exception : ERROR : File name too long':
                        detailMsg = $translate.instant('common.error_code.2531641_file_name_too_long');
                        break;
                    default:
                        detailMsg = error.errorMessage;
                }
            }

            // locale property에 에러코드가 존재하지 않으면 translate시 입력한 string 그대로 반환
            if (msg === errorCode) {
                msg = error.errorMessage;
            }

            new DialogService({
                title: $translate.instant('common.popup_title.request_failed'),
                type: 'alert',
                template: msg + '<br>' + detailMsg
            }).open();
        };

        commonFunctionService.checkExistAddress = function(toBeAddedAddress, addressList) {
            var length = addressList.length;
            // addressList 체크할 주소가 없을 때
            if (length === 0) {
                return false;
            }
            if (addressList[0].constructor === String) {
                for (var i = 0; i < length; i++) {
                    if (angular.equals(toBeAddedAddress.toLowerCase(), addressList[i].toLowerCase()) === true) {
                        return true;
                    }
                }
            } else {
                // addressList가 Object 타입의 리스트인 경우 KeyName이 존재함
                var keyName = Object.keys(addressList[0])[0];
                for (i = 0; i < length; i++) {
                    if (angular.equals(toBeAddedAddress.toLowerCase(), addressList[i][keyName].toLowerCase()) === true) {
                        return true;
                    }
                }
            }
            return false;
        };

        commonFunctionService.checkExistAddressForPlcyItemValCn = function(toBeAddedAddress, addressList) {
            var length = addressList.length;
            // addressList 체크할 주소가 없을 때
            if (length === 0) {
                return false;
            }
            for (var i = 0; i < length; i++) {
                if (angular.equals(toBeAddedAddress.toLowerCase(), addressList[i].plcyItemValCn.toLowerCase()) === true) {
                    return true;
                }
            }
            return false;
        };

        // sieve start

        /**
         * 시브 룰 조회용 공통함수
         * @param {*} serviceName : 서비스명(자동분류, 사용자라우팅룰, 트랜스포트룰 서브미션룰), constant.module.js 참조
         * @param {*} targetId : 계정정보, 자동분류와 사용자 라우팅룰은 개별 계정 정보가 필요함
         * @param {*} currentScope : 공통함수 서비스 함수가 개별 컨트롤러에게 받아서 처리하고 다시 반환할 컨트롤러의 $scope
         * @returns {*} currentScope
         */
        commonFunctionService.getRuleService = function(serviceName, targetId, currentScope) {
            ruleService[serviceName.GET](targetId)
                .$promise.then(function(data) {
                    currentScope.sieveListModelOrigin = angular.copy(data);
                    currentScope.sieveListModel = angular.copy(currentScope.sieveListModelOrigin);
                    LinkAniService.linkAniOff();
                })
                .then(function() {
                    if (currentScope.listApi) {
                        currentScope.listApi.setCheckAll(false);
                    }
                    // 시브 룰 조회 했는데 룰이 비어있을 때 처리, undefined
                    if (currentScope.sieveListModelOrigin.sieveRules === undefined) {
                        currentScope.sieveListModelOrigin.sieveRules = [];
                        currentScope.sieveListModel = angular.copy(currentScope.sieveListModelOrigin);
                    }
                });
            return currentScope;
        };

        /**
         * 시브 룰 업데이트용 공통함수
         * @param {*} serviceName : 서비스명(자동분류, 사용자라우팅룰, 트랜스포트룰 서브미션룰), constant.module.js 참조
         * @param {*} targetId : 계정정보, 자동분류와 사용자 라우팅룰은 개별 계정 정보가 필요함
         * @param {*} currentScopeData : 공통함수 서비스 함수가 개별 컨트롤러에게 받아서 처리하고 다시 반환할 컨트롤러의 $scope
         *
         */
        commonFunctionService.updateRuleService = function(serviceName, targetId, currentScopeData) {
            var currentScope = currentScopeData;

            // 혹시나 변경된 사항이 없는데 버튼이 눌릴 경우 그냥 return
            if (angular.equals(currentScopeData.sieveListModelOrigin, currentScopeData.sieveListModel)) {
                return;
            }

            if (targetId === undefined) {
                updateRuleServiceForSystem(serviceName, currentScope);
            } else {
                updateRuleServiceForUser(serviceName, targetId, currentScope);
            }
        };
        /**
         * 시스템용 룰 업데이트
            수정 직전에 시브 룰 데이터를 다시 조회해서 처음 데이터를 조회했을때와 시간이 변경되었는지 확인,
            변경되었다면 누군가 그 사이에 수정한 것 이므로 업데이트 액션을 중지시키고, 팝업을 띄움
            기타 UI작업 수행
         * @param {*} serviceName
         * @param {*} currentScope
         */
        function updateRuleServiceForSystem(serviceName, currentScope) {
            var beforeFnlMdfyTs;
            var currentFnlMdfyTs = currentScope.sieveListModelOrigin.fnlMdfyTs;
            ruleService[serviceName.GET]()
                .$promise.then(function(data) {
                    beforeFnlMdfyTs = data.fnlMdfyTs;
                })
                .then(function() {
                    if (beforeFnlMdfyTs !== currentFnlMdfyTs) {
                        LinkAniService.linkAniOff();
                        openSieveRuleAlertDialogAndReloading(serviceName, currentScope.sieveListModelOrigin.fnlMdfrId, currentScope);
                    } else {
                        var updateData = buildUpdateRuleData(currentScope);

                        ruleService[serviceName.UPDATE](updateData).$promise.then(function(data) {
                            LinkAniService.linkAniOff();
                            openSieveRuleSaveDialog(serviceName);

                            // 저장 후 선택 하이라이트 제거
                            if (currentScope.selectedRuleInfo && currentScope.selectedRuleInfo.rowIndex >= 0) {
                                currentScope.listApi.setSelected(currentScope.selectedRuleInfo.rowIndex, false);
                            }

                            // url에 적어뒀던 선택항목 정보 삭제
                            if (!$location.search()) {
                                $location.search({mlFltrConfId: undefined});
                            } else {
                                $location.search(RULE_INFO.ML_FLTR_CONF_ID, undefined);
                            }
                            currentScope.init();
                        });
                    }
                });
        }

        /**
         * 유저용 룰 업데이트
            수정 직전에 시브 룰 데이터를 다시 조회해서 처음 데이터를 조회했을때와 시간이 변경되었는지 확인,
            변경되었다면 누군가 그 사이에 수정한 것 이므로 업데이트 액션을 중지시키고, 팝업을 띄움
            기타 UI작업 수행
         * @param {*} serviceName
         * @param {*} targetId
         * @param {*} currentScope
         */
        function updateRuleServiceForUser(serviceName, targetId, currentScope) {
            var beforeFnlMdfyTs;
            var currentFnlMdfyTs = currentScope.sieveListModelOrigin.fnlMdfyTs;
            ruleService[serviceName.GET](targetId)
                .$promise.then(function(data) {
                    beforeFnlMdfyTs = data.fnlMdfyTs;
                })
                .then(function() {
                    if (beforeFnlMdfyTs !== currentFnlMdfyTs) {
                        LinkAniService.linkAniOff();
                        openSieveRuleAlertDialogAndReloading(serviceName, currentScope.sieveListModelOrigin.fnlMdfrId, currentScope);
                    } else {
                        var updateData = buildUpdateRuleData(currentScope);

                        ruleService[serviceName.UPDATE](targetId, updateData).$promise.then(function(data) {
                            LinkAniService.linkAniOff();
                            openSieveRuleSaveDialog(serviceName);
                            currentScope.close_desc();
                            currentScope.init();
                        });
                    }
                });
        }

        /**
         * 시브 전용 팝업
         * @param {*} serviceName
         */
        function openSieveRuleSaveDialog(serviceName) {
            if (serviceName.GET === 'getAutoClf') SaveConfirmUtilService.open($translate.instant('setting_one.config.sieve.save_auto_classify'), $translate.instant('common.label.save'));
            else if (serviceName.GET === 'getUserRoutingRule') SaveConfirmUtilService.open($translate.instant('setting_one.config.sieve.save_user_routing'), $translate.instant('common.label.save'));
            else if (serviceName.GET === 'getTransportRule') SaveConfirmUtilService.open($translate.instant('setting_one.config.sieve.save_transport'), $translate.instant('common.label.save'));
            else if (serviceName.GET === 'getSubmissionRule') SaveConfirmUtilService.open($translate.instant('setting_one.config.sieve.save_submission'), $translate.instant('common.label.save'));
            else if (serviceName.GET === 'getAutoForwarding') SaveConfirmUtilService.open($translate.instant('setting_one.config.sieve.save_auto_forward'), $translate.instant('common.label.save'));
            else {
                $log.log('openSieveRuleSaveDialog failed');
            }
        }

        /**
         * 시브 전용 팝업, 관리페이지는 동시 수정을 허용하지 않으므로 동시 수정 시도시 나중에 수정한 관리자는 에러 팝업 후 페이지 리로딩
         * @param {*} serviceName
         * @param {*} fnlMdfrId
         * @param {*} currentScope
         */
        function openSieveRuleAlertDialogAndReloading(serviceName, fnlMdfrId, currentScope) {
            var title;
            var msg = $translate.instant('setting_one.config.sieve.duplicate_error_msg') + fnlMdfrId;

            if (serviceName.GET === 'getAutoClf') title = 'setting_one.config.sieve.save_auto_classify';
            else if (serviceName.GET === 'getUserRoutingRule') title = 'setting_one.config.sieve.save_user_routing';
            else if (serviceName.GET === 'getTransportRule') title = 'setting_one.config.sieve.save_transport';
            else if (serviceName.GET === 'getSubmissionRule') title = 'setting_one.config.sieve.save_submission';
            else {
                title = 'alert';
                $log.log('OpenSieveRuleAlertDialog name not existed');
            }

            var dialog = new DialogService({
                type: 'confirm',
                title: $translate.instant(title),
                template: msg
            }).open();
            dialog.result.then(
                function() {
                    currentScope.init();
                },
                function(dismiss) {}
            );
        }

        /**
         * 자동분류룰인지 체크
         * @param {*} currentScope
         * @returns {boolean}
         */
        function isAutoClassifyRule(currentScope) {
            if (angular.isUndefined(currentScope.sieveListModelOrigin.autoClfs)) {
                return false;
            }
            return true;
        }

        /**
         * 시브 룰 업데이트.
         * @param {*} currentScope
         * @returns {*} update result
         */
        function buildUpdateRuleData(currentScope) {
            $log.debug('########## Sieve Rule update request - START ##########');
            var updateData = {};

            // 0. 규칙 추가/수정/삭제 여부 확인 위해 사본 사용
            var autoClfsCopiedOrigin;
            var autoClfsCopied;

            if (isAutoClassifyRule(currentScope)) {
                // 전체 사용여부 설정 비교
                updateData.autoClassificationEnabled = angular.copy(currentScope.sieveListModel.autoClassificationEnabled);
                autoClfsCopiedOrigin = angular.copy(currentScope.sieveListModelOrigin.autoClfs);
                autoClfsCopied = angular.copy(currentScope.sieveListModel.autoClfs);
            } else {
                autoClfsCopiedOrigin = angular.copy(currentScope.sieveListModelOrigin.sieveRules);
                autoClfsCopied = angular.copy(currentScope.sieveListModel.sieveRules);
            }

            updateData.removes = [];
            updateData.inserts = [];
            updateData.updates = [];

            // 1. 삭제된 규칙들 먼저
            updateData.removes = (function() {
                var data = [];

                for (var i = autoClfsCopiedOrigin.length - 1; i >= 0; i--) {
                    var foundIdentical = false;

                    for (var j in autoClfsCopied) {
                        if (autoClfsCopiedOrigin[i].mlFltrConfId === autoClfsCopied[j].mlFltrConfId) {
                            foundIdentical = true;
                            break;
                        }
                    }

                    if (!foundIdentical) {
                        data.push(autoClfsCopiedOrigin[i].mlFltrConfId);
                        autoClfsCopiedOrigin.splice(i, 1);
                    }
                }

                return data;
            })();

            // 2. 그 다음 추가된 규칙들
            updateData.inserts = (function() {
                var data = [];

                for (var i = autoClfsCopied.length - 1; i >= 0; i--) {
                    if (!autoClfsCopied[i].mlFltrConfId) {
                        var keyArray = Object.keys(autoClfsCopied[i]);
                        for (var j in keyArray) {
                            // 임시로 rule object에 붙여 놓은 rulCtrl이라는 키는 삭제
                            if (angular.equals(keyArray[j], RULE_INFO.KW_RULE_CTRL)) {
                                delete autoClfsCopied[i][keyArray[j]];
                                break;
                            }
                        }
                        data.push(autoClfsCopied.splice(i, 1)[0]);
                    }
                }

                return data;
            })();

            // 1, 2번 과정을 거쳤다면, 0번에서 생성한 두 배열은 같은 규칙들이 들어있는 원본과 사본임
            updateData.updates = (function() {
                // 용이한 비교를 위해 id 기준으로 정렬 후 사용
                var sortById = function(a, b) {
                    if (a.mlFltrConfId < b.mlFltrConfId) return -1;
                    else return 1;
                };
                autoClfsCopiedOrigin.sort(sortById);
                autoClfsCopied.sort(sortById);

                var data = [];

                var length = autoClfsCopiedOrigin.length;

                if (length !== null && length !== undefined) {
                    for (var index = 0; index < length; index++) {
                        // 원본과 수정본이 다른 경우
                        if (!angular.equals(autoClfsCopiedOrigin[index], autoClfsCopied[index])) {
                            // 임시로 rule object에 붙여 놓은 rulCtrl이라는 키는 삭제
                            delete autoClfsCopied[index][RULE_INFO.KW_RULE_CTRL];
                            // 스크립트가 같은 경우 삭제
                            if (autoClfsCopiedOrigin[index][RULE_INFO.ML_FLTR_CONF_SCPT_CLOB_CN] === autoClfsCopied[index][RULE_INFO.ML_FLTR_CONF_SCPT_CLOB_CN]) {
                                delete autoClfsCopied[index][RULE_INFO.ML_FLTR_CONF_SCPT_CLOB_CN];
                            }
                            data.push(autoClfsCopied[index]);
                        }
                    }
                }

                return data;
            })();

            $log.debug(updateData);
            $log.debug('########## Sieve Rule update request - END ##########');
            return updateData;
        }

        // sieve end

        // Date Checker
        // 날짜 타입 체크
        commonFunctionService.isValidDate = function(dateStr) {
            if (dateStr === undefined) {
                return false;
            }

            var dateTime = Date.parse(dateStr);

            if (dateTime === undefined) {
                return false;
            }

            if (isNaN(dateTime)) {
                return false;
            }

            if (!angular.isDate(new Date(dateTime))) {
                return false;
            }

            return true;
        };

        // 두 날짜간 차이(timestamp)
        commonFunctionService.getDateDifference = function(fromDate, toDate) {
            return Date.parse(toDate) - Date.parse(fromDate);
        };

        // fromDate, toDate 사이의 간격이 period일 이상인지
        commonFunctionService.isOverPeriodOfTime = function(fromDate, toDate, period) {
            if (commonFunctionService.isValidDateRange(fromDate, toDate)) {
                if (commonFunctionService.getDateDifference(fromDate, toDate) > 86400000 * (period - 1)) {
                    return true;
                }
            }
            return false;
        };

        // 날짜 차이 범위가 유효한지 확인. 날짜가 입력되지 않은 경우에는 범위를 구할 수 없지만 true로 본다
        commonFunctionService.isValidDateRange = function(fromDate, toDate) {
            if (fromDate === '' || toDate === '') return true;
            if (commonFunctionService.isValidDate(fromDate) === false) {
                return false;
            }
            if (commonFunctionService.isValidDate(toDate) === false) {
                return false;
            }

            if (commonFunctionService.isValidDate(toDate) === true) {
                var days = commonFunctionService.getDateDifference(fromDate, toDate);

                if (days < 0) {
                    return false;
                }
            }
            return true;
        };

        // date checker end

        // domain checker start ...

        var externalAutoRequestData;
        var domainListData;
        var setData;

        commonFunctionService.initAvailableDomain = function() {
            setExternalAutoRequestData();
            setMailDomainData();
        };

        // input email이 사용 가능한 도메인인지 체크
        commonFunctionService.checkAvailableDomain = function(email) {
            if (!externalAutoRequestData.externalAutoRequestControlEnabled) {
                return true;
            }

            var isAvailableDomain = false;
            var checked = -1;
            var length = domainListData.length;
            var checkDomain;
            var emailDomain = email.split('@')[1];
            for (var i = 0; i < length; i++) {
                checkDomain = domainListData[i].mlDomId;
                checked = checkDomain.indexOf(emailDomain);
                if (checked === 0) {
                    isAvailableDomain = true;
                    break;
                }
            }

            if (!isAvailableDomain) {
                length = externalAutoRequestData.externalAutoRequestAccessDomainAddress.length;
                for (i = 0; i < length; i++) {
                    checkDomain = externalAutoRequestData.externalAutoRequestAccessDomainAddress[i];
                    checked = checkDomain.indexOf(emailDomain);
                    if (checked === 0) {
                        isAvailableDomain = true;
                        break;
                    }
                }
            }

            if (!isAvailableDomain) {
                return false;
            }
            return true;
        };

        // 내부 도메인인지 체크
        commonFunctionService.checkInternalDomain = function(email) {
            var length = domainListData.length;
            var checkDomain;
            var emailDomain = email.split('@')[1];
            for (var i = 0; i < length; i++) {
                checkDomain = domainListData[i].mlDomId;
                if (checkDomain === emailDomain) {
                    return true;
                }
            }
            return false;
        };

        // 정책관리 > 세트설정 > 외부 자동 재전송 제어
        var setExternalAutoRequestData = function() {
            setResource.get().$promise.then(function(data) {
                setData = angular.copy(data.plcyItemCodeValues);
                initExternalAutoRequest(setData);
            });
        };

        // 서버관리 > 메일도메인
        var setMailDomainData = function() {
            mailDomainResource.query(undefined, undefined).$promise.then(function(data) {
                domainListData = angular.copy(data.rows);
            });
        };

        // 외부 자동 재전송 제어 도메인, 외부 자동 재전송 제어 사용여부 initialize
        var initExternalAutoRequest = function(setData) {
            var enabled = false;
            var length = setData.externalAutoRequestControlEnabled.valueList.length;
            for (var i = 0; i < length; i++) {
                if (setData.externalAutoRequestControlEnabled.valueList[i].plcyItemValCn === 'Y' && setData.externalAutoRequestControlEnabled.valueList[i].selected === 'Y') {
                    enabled = true;
                    break;
                }
            }
            length = setData.externalAutoRequestAccessDomainAddress.valueList.length;
            var domainAddress = [];
            for (i = 0; i < length; i++) {
                domainAddress.push(setData.externalAutoRequestAccessDomainAddress.valueList[i].plcyItemValCn);
            }
            externalAutoRequestData = {
                externalAutoRequestAccessDomainAddress: domainAddress,
                externalAutoRequestControlEnabled: enabled
            };
        };

        // domain checker end

        // 축약형 -> 일반형
        commonFunctionService.changeOrgTypeCodeFromAbbreviateTypeToNormalType = function(orgTypeCode) {
            if (orgTypeCode === null || orgTypeCode === undefined) {
                return undefined;
            }
            if (orgTypeCode === 'COMP') {
                return 'COMPANY';
            } else if (orgTypeCode === 'DEPT') {
                return 'DEPARTMENT';
            } else if (orgTypeCode === 'SUBUSI') {
                return 'SUBUSI';
            } else if (orgTypeCode === 'BUSI') {
                return 'BUSINESS';
            } else if (orgTypeCode === 'SUBORG') {
                return 'SUBORG';
            } else {
                return orgTypeCode;
            }
        };

        // 일반형 -> 축약형
        commonFunctionService.changeOrgTypeCodeFromNormalTypeToAbbreviateType = function(orgTypeCode) {
            if (orgTypeCode === null || orgTypeCode === undefined) {
                return undefined;
            }
            if (orgTypeCode === 'COMPANY') {
                return 'COMP';
            } else if (orgTypeCode === 'DEPARTMENT') {
                return 'DEPT';
            } else if (orgTypeCode === 'SUBUSI') {
                return 'SUBUSI';
            } else if (orgTypeCode === 'BUSINESS') {
                return 'BUSI';
            } else if (orgTypeCode === 'SUBORG') {
                return 'SUBORG';
            } else {
                return orgTypeCode;
            }
        };

        // UI에서는 yyyy-mm-dd로 보여야하지만 서버 포맷인 yyyymmdd 으로 변경이 필요
        commonFunctionService.changeYYYYMMDDToDatetimeFormat = function(dateString) {
            if (/^(\d){8}$/.test(dateString)) {
                var y = dateString.substr(0, 4);
                var m = dateString.substr(4, 2);
                var d = dateString.substr(6, 2);
                // 로컬 타임존 적용은 없앰, 월 단위는 0부터
                return new Date(Date.UTC(y, m - 1, d));
            } else {
                return new Date(Date.parse(dateString));
            }
        };

        commonFunctionService.changeDatetimeToStringFormat = function(dateObject) {
            return new Date(Date.parse(dateObject)).toISOString().split('T')[0].replace(/-/g, '');
        };

        /**
         * 관리자의 소속과 비교하여 해당 계정의 소속과 라스트로그인소속에 따른 처리
         * @param {*} type
         * @param {*} affilationInfo
         * @param {*} lastLoginInfo
         * @param {*} plcyId
         * @param {*} dispBtPlcyId
         * @returns {*} object: {
         *      isViewAuth: 조회권한
         *      isEditAuth: 수정권한
         *      desc: 권한에 따른 문구
         *      alert: 수정권한이 없을때 에러처리
         * }
         */
        commonFunctionService.setAffilationOrgInfoDesc = function(type, affilationInfo, lastLoginInfo, plcyId, dispBtPlcyId) {
            // 원소속관리자
            var originAuth = isOriginAdmin(affilationInfo);
            // 파견소속 관리자
            var dispAuth = isSubAdmin(affilationInfo);
            // 상위 권한 관리자
            var upperAuth = !!(originAuth && dispAuth);

            // 사용자 예외 정책 탭
            if (type === POLICY_TYPE.USER_POLICY) {
                if (upperAuth === true) {
                    return {isViewAuth: true, isEditAuth: true, desc: ''};
                }
                if (originAuth === true) {
                    return {isViewAuth: true, isEditAuth: true, desc: ''};
                }
                if (dispAuth === true) {
                    return {isViewAuth: true, isEditAuth: false, desc: '', alert: $translate.instant('policy.affiliation.notAuthDescDisp')};
                }
                return {isViewAuth: false, isEditAuth: false, desc: 'auth failed', alert: 'auth failed'};
            }

            // 사용자 예외 발신통제 원소속 탭
            if (type === POLICY_TYPE.USER_LOGIN_BT_POLICY_ORIGINAL) {
                // 파견소속이 없음
                if (affilationInfo[POLICY_TYPE.SUB] === undefined) {
                    return {
                        isViewAuth: true,
                        isEditAuth: true,
                        desc:
                            $translate.instant('policy.affiliation.originPrefix') +
                            affilationInfo.O.compName +
                            $translate.instant('policy.affiliation.commonPostfix') +
                            $translate.instant('policy.affiliation.originPolicy')
                    };
                } else {
                    // 원소속과 파견소속의 회사가 같고
                    if (affilationInfo[POLICY_TYPE.ORIGIN].compCode === affilationInfo[POLICY_TYPE.SUB].compCode) {
                        // 같은 조직 정책을 가짐
                        if (plcyId === dispBtPlcyId) {
                            return {isViewAuth: true, isEditAuth: true, desc: $translate.instant('policy.affiliation.samePolicy')};
                        }
                        // 다른 조직정책을 가짐
                        if (plcyId !== dispBtPlcyId) {
                            return {
                                isViewAuth: true,
                                isEditAuth: true,
                                desc:
                                    $translate.instant('policy.affiliation.originPrefix') +
                                    affilationInfo.O.compName +
                                    $translate.instant('policy.affiliation.commonPostfix') +
                                    $translate.instant('policy.affiliation.originPolicy')
                            };
                        }
                        return {isViewAuth: false, isEditAuth: false, desc: 'auth failed', alert: 'auth failed'};
                    }
                    // 해당 계정이 원소속 로그인 상태임
                    if (lastLoginInfo === POLICY_TYPE.ORIGIN) {
                        if (upperAuth === true) {
                            return {
                                isViewAuth: true,
                                isEditAuth: true,
                                desc:
                                    $translate.instant('policy.affiliation.originPrefix') +
                                    affilationInfo.O.compName +
                                    $translate.instant('policy.affiliation.commonPostfix') +
                                    $translate.instant('policy.affiliation.originPolicy')
                            };
                        }
                        if (originAuth === true) {
                            return {
                                isViewAuth: true,
                                isEditAuth: true,
                                desc:
                                    $translate.instant('policy.affiliation.originPrefix') +
                                    affilationInfo.O.compName +
                                    $translate.instant('policy.affiliation.commonPostfix') +
                                    $translate.instant('policy.affiliation.originPolicy')
                            };
                        }
                        if (dispAuth === true) {
                            return {
                                isViewAuth: true,
                                isEditAuth: false,
                                desc:
                                    $translate.instant('policy.affiliation.originPrefix') +
                                    affilationInfo.O.compName +
                                    $translate.instant('policy.affiliation.commonPostfix') +
                                    $translate.instant('policy.affiliation.originPolicy'),
                                alert: $translate.instant('policy.affiliation.notAuthDescDisp')
                            };
                        }
                        return {isViewAuth: false, isEditAuth: false, desc: 'auth failed', alert: 'auth failed'};
                    }
                    if (lastLoginInfo === POLICY_TYPE.SUB) {
                        if (upperAuth === true) {
                            return {
                                isViewAuth: true,
                                isEditAuth: true,
                                desc:
                                    $translate.instant('policy.affiliation.dispPrefix') +
                                    affilationInfo.S.compName +
                                    $translate.instant('policy.affiliation.commonPostfix') +
                                    $translate.instant('policy.affiliation.dispPolicy')
                            };
                        }
                        if (originAuth === true) {
                            return {
                                isViewAuth: true,
                                isEditAuth: true,
                                desc:
                                    $translate.instant('policy.affiliation.dispPrefix') +
                                    affilationInfo.S.compName +
                                    $translate.instant('policy.affiliation.commonPostfix') +
                                    $translate.instant('policy.affiliation.dispPolicy')
                            };
                        }
                        if (dispAuth === true) {
                            return {
                                isViewAuth: true,
                                isEditAuth: false,
                                desc:
                                    $translate.instant('policy.affiliation.dispPrefix') +
                                    affilationInfo.S.compName +
                                    $translate.instant('policy.affiliation.commonPostfix') +
                                    $translate.instant('policy.affiliation.dispPolicy'),
                                alert: $translate.instant('policy.affiliation.notAuthDescDisp')
                            };
                        }
                        return {isViewAuth: false, isEditAuth: false, desc: 'auth failed', alert: 'auth failed'};
                    }
                }
            }

            // 사용자 예외 발신통제 파견소속 탭
            if (type === POLICY_TYPE.USER_LOGIN_BT_POLICY_SUB) {
                // 파견소속이 없음
                if (affilationInfo[POLICY_TYPE.SUB] === undefined) {
                    return {isViewAuth: false, isEditAuth: false, desc: $translate.instant('policy.affiliation.notExistDispPolicy')};
                } else {
                    // 해당 계정이 원소속 로그인 상태임
                    if (lastLoginInfo === POLICY_TYPE.ORIGIN) {
                        if (upperAuth === true) {
                            return {
                                isViewAuth: true,
                                isEditAuth: true,
                                desc:
                                    $translate.instant('policy.affiliation.originPrefix') +
                                    affilationInfo.O.compName +
                                    $translate.instant('policy.affiliation.commonPostfix') +
                                    $translate.instant('policy.affiliation.originPolicy')
                            };
                        }
                        if (originAuth === true) {
                            return {
                                isViewAuth: true,
                                isEditAuth: false,
                                desc:
                                    $translate.instant('policy.affiliation.originPrefix') +
                                    affilationInfo.O.compName +
                                    $translate.instant('policy.affiliation.commonPostfix') +
                                    $translate.instant('policy.affiliation.originPolicy')
                            };
                        }
                        if (dispAuth === true) {
                            return {
                                isViewAuth: true,
                                isEditAuth: true,
                                desc:
                                    $translate.instant('policy.affiliation.originPrefix') +
                                    affilationInfo.O.compName +
                                    $translate.instant('policy.affiliation.commonPostfix') +
                                    $translate.instant('policy.affiliation.originPolicy')
                            };
                        }
                        return {isViewAuth: false, isEditAuth: false, desc: 'auth failed', alert: 'auth failed'};
                    }
                    if (lastLoginInfo === POLICY_TYPE.SUB) {
                        if (upperAuth === true) {
                            return {
                                isViewAuth: true,
                                isEditAuth: true,
                                desc:
                                    $translate.instant('policy.affiliation.dispPrefix') +
                                    affilationInfo.S.compName +
                                    $translate.instant('policy.affiliation.commonPostfix') +
                                    $translate.instant('policy.affiliation.dispPolicy')
                            };
                        }
                        if (originAuth === true) {
                            return {
                                isViewAuth: true,
                                isEditAuth: false,
                                desc:
                                    $translate.instant('policy.affiliation.dispPrefix') +
                                    affilationInfo.S.compName +
                                    $translate.instant('policy.affiliation.commonPostfix') +
                                    $translate.instant('policy.affiliation.dispPolicy')
                            };
                        }
                        if (dispAuth === true) {
                            return {
                                isViewAuth: true,
                                isEditAuth: true,
                                desc:
                                    $translate.instant('policy.affiliation.dispPrefix') +
                                    affilationInfo.S.compName +
                                    $translate.instant('policy.affiliation.commonPostfix') +
                                    $translate.instant('policy.affiliation.dispPolicy')
                            };
                        }
                        return {isViewAuth: false, isEditAuth: false, desc: 'auth failed', alert: 'auth failed'};
                    }
                }
            }
        };

        /**
         * 특정 계정의 원소속에 대한 권한이 있는 관리자인지 확인
         * @param {*} affilationInfo 원소속에 대한 정보는 필수값이며, 파견소속 정보는 없을 수 있음
         * @returns {boolean}
         */
        var isOriginAdmin = function(affilationInfo) {
            // ENCMP : 전사, MUL : 조직선택, OWN :소속사
            var adminPermssionType = $cookies.get('dataPermissionType');
            var adminManageOrgList = JSON.parse($cookies.get('objectsToBeFiltered'));

            // 전사 관리자는 모든 원소속에 대한 권한을 가짐
            if (adminPermssionType === 'ENCMP') {
                return true;
            }

            // 소속사 관리자는 관리자의 소속회사와 특정 계정의 원소속이 같은 회사인지 확인
            if (adminPermssionType === 'OWN') {
                if (adminManageOrgList[0].compCode === affilationInfo[POLICY_TYPE.ORIGIN].compCode) {
                    return true;
                }
            }

            // 여러 소속 권한을 가진 관리자는 특정 계정의 원소속의 회사에 대한 권한을 가진지 확인해야함
            if (adminPermssionType === 'MUL') {
                for (var idx in adminManageOrgList) {
                    if (adminManageOrgList[idx].compCode === affilationInfo[POLICY_TYPE.ORIGIN].compCode) {
                        return true;
                    }
                }
            }

            return false;
        };

        /**
         * 특정 계정의 파견소속에 대한 권한이 있는 관리자인지 확인
         * @param {*} affilationInfo 원소속에 대한 정보는 필수값이며, 파견소속 정보는 없을 수 있음
         * @returns {boolean}
         */
        var isSubAdmin = function(affilationInfo) {
            // 파견소속 정보는 없을 수 있으며, 이때는 false
            if (affilationInfo[POLICY_TYPE.SUB] === undefined) {
                return false;
            }

            // ENCMP : 전사, MUL : 조직선택, OWN :소속사
            var adminPermssionType = $cookies.get('dataPermissionType');
            var adminManageOrgList = JSON.parse($cookies.get('objectsToBeFiltered'));

            // 전사 관리자는 모든 파견소속에 대한 권한을 가짐
            if (adminPermssionType === 'ENCMP') {
                return true;
            }

            // 소속사 관리자는 관리자의 소속회사와 특정 계정의 파견소속이 같은 회사인지 확인
            if (adminPermssionType === 'OWN') {
                if (adminManageOrgList[0].compCode === affilationInfo[POLICY_TYPE.SUB].compCode) {
                    return true;
                }
            }

            // 여러 소속 권한을 가진 관리자는 특정 계정의 파견소속의 회사에 대한 권한을 가진지 확인해야함
            if (adminPermssionType === 'MUL') {
                for (var idx in adminManageOrgList) {
                    if (adminManageOrgList[idx].compCode === affilationInfo[POLICY_TYPE.SUB].compCode) {
                        return true;
                    }
                }
            }

            return false;
        };

        return commonFunctionService;
    }
})();
