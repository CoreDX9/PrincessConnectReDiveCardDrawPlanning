var app = new Vue({
    el: '#app',
    template: '#template',
    data: function () {
        var now = new Date();

        var cardPoolList = cardPoolData;
        for (var i = 0; i < cardPoolList.length; i++) {
            if (cardPoolList[i].date.constructor == String) {
                cardPoolList[i].date = new Date(cardPoolList[i].date)
            }
        }

        return {
            form: {
                startDiamond: 0,
                dailyDiamond: 115,
                dateStart: now.toString(),
                dateEnd: new Date([now.getFullYear() + 2, now.getMonth() + 1, now.getDate()].join('/')),
                getUpCardCastCount: 300,
                temporarySupplementDrawCardCount: 0,
                eventPoolCount: 6,
                teamWarDiamond: 3000,
                monthDiamondFix: 4000 + 1650,
                drawCardPolicy: '1',
                cardPoolList: cardPoolList,
                skipNotS3: true,
                skipNotSpecial: true,
                skipList: [],
                hideSkipedCardPool: false,
                extraDiamondSupplements: []
            },
            planReport: {
                diamondChart: [],
                drawCardReport: []
            },
            reverse: false,
            activities: []
        };
    },
    methods: {
        addCardPool: function () {
            this.form.cardPoolList.push({
                date: new Date(),
                name: '',
                star: 3,
                isSpecial: false
            });
        },
        removeCardPool: function (index) {
            this.form.cardPoolList.splice(index, 1);
        },
        sortCardPool: function () {
            this.form.cardPoolList = this.form.cardPoolList.asEnumerable().orderBy(x => new Date(x.date)).toArray();
        },
        addExtraDiamond: function () {
            this.form.extraDiamondSupplements.push({
                date: (new Date()).toString(),
                diamond: 0,
                comment: ""
            });
        },
        removeExtraDiamond: function (index) {
            this.form.extraDiamondSupplements.splice(index, 1);
        },
        sortExtraDiamond: function () {
            this.form.extraDiamondSupplements = this.form.extraDiamondSupplements.asEnumerable().orderBy(x => new Date(x.date)).toArray();
        },
        plan: function () {
            var form = this.form;
            var planReport = this.planReport;
            var skipList = form.skipList;
            var skipNotS3 = form.skipNotS3;
            var skipNotSpecial = form.skipNotSpecial;
            var date = new Date(form.dateStart);
            var dateEnd = new Date(form.dateEnd);
            var diamond = form.startDiamond;

            planReport.diamondChart = [];
            planReport.drawCardReport = [];

            while (true) {
                if (diffDay(date, dateEnd) > 0) {
                    break;
                }
                var chartReport = {
                    date: [date.getFullYear(), date.getMonth() + 1, date.getDate()].join('/'),
                    diamond: 0,
                    events: []
                };

				//结算日常，包括签到奖的每日均摊，双竞技场排名奖励，维护补偿的每日均摊
                diamond += form.dailyDiamond;

                //结算团队战钻石
                if (date.getDate() == 10) {
                    diamond += form.teamWarDiamond;
                    chartReport.events.push({
                        type: '团队战结算钻石',
                        msg: '钻石持有数额外增加' + form.teamWarDiamond.toString()
                    })
                }

                //结算修正钻石，包括露娜塔，双竞技场重置钻石的每月均摊
                if (date.getDate() == 15) {
                    diamond += form.monthDiamondFix;
                    chartReport.events.push({
                        type: '每月修正结算钻石',
                        msg: '钻石持有数额外增加' + form.monthDiamondFix.toString()
                    })
                }

                //结算活动钻石
                if (date.getDate() == 26) {
					var eventDiamond = 5 * 5 + 10 * 10 + 15 * 15 + 25 * 20 + (25 * 5) * (form.eventPoolCount - 4);//讨伐证兑换钻石
					eventDiamond += 900 + 450 + 100 + 160 + 190 + 340;//其他一次性活动钻石，如推图首通、剧情阅读等
                    diamond = diamond + eventDiamond;
                    chartReport.events.push({
                        type: '剧情活动结算钻石',
                        msg: '钻石持有数额外增加' + eventDiamond.toString()
                    })
                }

                var extra = form.extraDiamondSupplements.asEnumerable().where(x => isSameDay(new Date(x.date), date)).toArray();
                if (extra.length > 0) extra.forEach((item, index) => {
                    diamond += item.diamond;

                    if (item.diamond >= 0) {
                        chartReport.events.push({
                            type: '额外补充钻石',
                            msg: '钻石持有数额外增加' + item.diamond.toString()
                        })
                    }
                    else {
                        chartReport.events.push({
                            type: '额外扣除钻石',
                            msg: '钻石持有数额外扣除' + (item.diamond * -1).toString()
                        })
                    }
                });

                var drawCardReport = null;

                var filter = function (item) {
                    var isSameDate = isSameDay(date, item.date);
                    var isInSkipList = skipList.asEnumerable().any(x => x == item.name);
                    var isPassWithRule = (skipNotS3 ? item.star >= 3 : true) && (skipNotSpecial ? item.isSpecial : true);
                    return isSameDate && !isInSkipList && isPassWithRule;
                };

                var cardPool = cardPoolData.asEnumerable().where(filter).toArray();
                cardPool = cardPool.length == 1 ? cardPool[0] : null;
                if (cardPool != null) {
                    var castDiamond = form.getUpCardCastCount * 150;
                    if (diamond >= castDiamond) {
                        chartReport.events.push({
                            type: '抽卡',
                            msg: '在 ' + cardPool.name + ' 中抽卡消费钻石' + castDiamond.toString()
                        });

                        drawCardReport = {
                            date: new Date(date),
                            cardPool: cardPool.name,
                            hasDiamond: diamond,
                            supplementedDiamond: 0,
                            totalDiamond: diamond,
                            drawCardPolicy: '直接抽卡',
                            surplusDiamond: diamond - castDiamond
                        };

                        diamond = drawCardReport.surplusDiamond;
                    }
                    else if (diamond + (form.temporarySupplementDrawCardCount * 150) >= castDiamond) {
                        var supplementDiamond = 0;

                        for (var i = 1; i <= form.temporarySupplementDrawCardCount; i++) {
                            if (diamond + (i * 150) >= castDiamond) {
                                supplementDiamond = (i * 150);
                                break;
                            }
                        }
                        var temporaryDiamond = diamond + supplementDiamond;

                        chartReport.events.push({
                            type: '临时补充钻石',
                            msg: '在 ' + cardPool.name + ' 中临时补充钻石' + supplementDiamond.toString()
                        });

                        chartReport.events.push({
                            type: '抽卡',
                            msg: '在 ' + cardPool.name + ' 中抽卡消费钻石' + castDiamond.toString()
                        });

                        drawCardReport = {
                            date: new Date(date),
                            cardPool: cardPool.name,
                            hasDiamond: diamond,
                            supplementedDiamond: supplementDiamond,
                            totalDiamond: temporaryDiamond,
                            drawCardPolicy: '补充钻石抽卡',
                            surplusDiamond: temporaryDiamond - castDiamond
                        };

                        diamond = drawCardReport.surplusDiamond;
                    }
                    else {
                        if (form.drawCardPolicy == '1') {
                            chartReport.events.push({
                                type: '放弃抽卡',
                                msg: '在 ' + cardPool.name + ' 中放弃抽卡'
                            });

                            drawCardReport = {
                                date: new Date(date),
                                cardPool: cardPool.name,
                                hasDiamond: diamond,
                                supplementedDiamond: 0,
                                totalDiamond: diamond,
                                drawCardPolicy: '放弃抽卡',
                                surplusDiamond: diamond
                            };
                        }
                        if (form.drawCardPolicy == '2') {
                            var supplementDiamond = form.temporarySupplementDrawCardCount * 150;
                            var temporaryDiamond = diamond + supplementDiamond;

                            chartReport.events.push({
                                type: '临时补充钻石',
                                msg: '在 ' + cardPool.name + ' 中临时补充钻石' + supplementDiamond.toString()
                            });

                            var trueCastDiamond = parseInt(temporaryDiamond / 150) * 150;

                            chartReport.events.push({
                                type: '强行抽卡',
                                msg: '在 ' + cardPool.name + ' 中强行抽卡消费钻石' + trueCastDiamond.toString()
                            });

                            drawCardReport = {
                                date: new Date(date),
                                cardPool: cardPool.name,
                                hasDiamond: diamond,
                                supplementedDiamond: supplementDiamond,
                                totalDiamond: temporaryDiamond,
                                drawCardPolicy: '补充钻石强行抽卡',
                                surplusDiamond: temporaryDiamond - trueCastDiamond
                            };

                            diamond = drawCardReport.surplusDiamond;
                        }
                    }
                } else {
                    if (!form.hideSkipedCardPool) {
                        var skipFilter = function (item) {
                            var isSameDate = isSameDay(date, item.date);
                            return isSameDate;
                        };
                        var skipCardPool = cardPoolData.asEnumerable().where(skipFilter).toArray();
                        skipCardPool = skipCardPool.length == 1 ? skipCardPool[0] : null;

                        if (skipCardPool != null) {
                            chartReport.events.push({
                                type: '跳过卡池',
                                msg: '跳过卡池 ' + skipCardPool.name
                            });

                            drawCardReport = {
                                date: new Date(date),
                                cardPool: skipCardPool.name,
                                hasDiamond: diamond,
                                supplementedDiamond: 0,
                                totalDiamond: diamond,
                                drawCardPolicy: '跳过卡池',
                                surplusDiamond: diamond
                            };
                        }
                    }
                }

                chartReport.diamond = diamond;

                planReport.diamondChart.push(chartReport);
                if (drawCardReport != null) planReport.drawCardReport.push(drawCardReport);

                date = date.setDate(date.getDate() + 1);
                date = new Date(date);
            }

            this.activities = planReport.diamondChart.asEnumerable().where(x => x.events.length > 0).selectMany(x => x.events.asEnumerable().select(y => { return { date: x.date, event: y }; })).toArray();
            drawChart(planReport.diamondChart.asEnumerable().select(x => x.date).toArray(), planReport.diamondChart.asEnumerable().select(x => x.diamond).toArray());
        },
        saveCardPool: function () {
            this.sortCardPool();

            var form = this.form;

            // 创建a标签
            var elementA = document.createElement('a');

            //文件的名称为时间戳加文件名后缀
            elementA.download = 'cardPoolData.js';
            elementA.style.display = 'none';

            var data = JSON.parse(JSON.stringify(form.cardPoolList));

            //生成一个blob二进制数据，内容为js数据
            var blob = new Blob(['var cardPoolData = ' + JSON.stringify(data, null, 4)]);

            //生成一个指向blob的URL地址，并赋值给a标签的href属性
            elementA.href = URL.createObjectURL(blob);
            document.body.appendChild(elementA);
            elementA.click();
            document.body.removeChild(elementA);
        },
        saveConfig: function () {
            this.sortExtraDiamond();
            var form = this.form;

            // 创建a标签
            var elementA = document.createElement('a');

            //文件的名称为时间戳加文件名后缀
            elementA.download = 'pcrConfig.json';
            elementA.style.display = 'none';

            var data = JSON.parse(JSON.stringify(form));
            delete data.cardPoolList;
            //生成一个blob二进制数据，内容为json数据
            var blob = new Blob([JSON.stringify(data, null, 4)]);

            //生成一个指向blob的URL地址，并赋值给a标签的href属性
            elementA.href = URL.createObjectURL(blob);
            document.body.appendChild(elementA);
            elementA.click();
            document.body.removeChild(elementA);

            this.clearSelect('config');
        },
        readConfig: function () {
            var form = this.form;
            var file = document.getElementById('config').files;

            if (file.length <= 0) {
                this.$notify.error({
                    title: '错误',
                    message: '请先选择配置文件'
                });
                return;
            }

            var reader = new FileReader();
            reader.readAsText(file[0], 'utf-8');
            reader.onload = function () {
                Object.assign(form, JSON.parse(reader.result));
            }
        },
        clearSelect: function (id) {
            document.getElementById(id).value = '';
        },
        tableRowClassName: function ({ row, rowIndex }) {
            if (row.drawCardPolicy == '直接抽卡') { return 'success-row'; }
            if (row.drawCardPolicy == '补充钻石抽卡') { return 'success-row'; }
            if (row.drawCardPolicy == '放弃抽卡') { return 'danger-row'; }
            if (row.drawCardPolicy == '补充钻石强行抽卡') { return 'warning-row'; }
            if (row.drawCardPolicy == '跳过卡池') { return 'primary-row'; }
            return '';
        }
    }
});

function diffDay(date1, date2) {
    if (date1 == null || date2 == null) return -2;
    if (date1.getFullYear() > date2.getFullYear()) return 1;
    if (date1.getFullYear() < date2.getFullYear()) return -1;
    if (date1.getMonth() > date2.getMonth()) return 1;
    if (date1.getMonth() < date2.getMonth()) return -1;
    if (date1.getDate() > date2.getDate()) return 1;
    if (date1.getDate() < date2.getDate()) return -1;
    return 0;
}

function isSameDay(date1, date2) {
    return diffDay(date1, date2) == 0;
}

var myChart = echarts.init(document.getElementById("chart"));
function drawChart(date, data) {
    var dom = document.getElementById("chart");

    dom.style.width = document.getElementById("pane-0").offsetWidth.toString() + 'px';
    dom.style.width = (dom.style.width == '0px' ? document.getElementById("pane-1").offsetWidth.toString() + 'px' : dom.style.width);
    dom.style.width = (dom.style.width == '0px' ? document.getElementById("pane-2").offsetWidth.toString() + 'px' : dom.style.width);
    myChart.resize();
    //var myChart = echarts.init(dom);

    window.addEventListener("resize", () => {
        if (document.getElementById('tab-3').classList.asEnumerable().any(x => x.value == 'is-active')) {
            dom.style.width = document.getElementById("pane-3").offsetWidth.toString() + 'px';
            myChart.resize();
        }
    });

    option = null;

    option = {
        tooltip: {
            trigger: 'axis',
            position: function (pt) {
                return [pt[0], '10%'];
            }
        },
        title: {
            left: 'center',
            text: '钻石持有量走势图',
        },
        toolbox: {
            feature: {
                dataZoom: {
                    yAxisIndex: 'none'
                },
                restore: {},
                saveAsImage: {}
            }
        },
        xAxis: {
            type: 'category',
            boundaryGap: false,
            data: date
        },
        yAxis: {
            type: 'value',
            boundaryGap: [0, '100%']
        },
        dataZoom: [{
            type: 'inside',
            start: 0,
            end: 10
        }, {
            start: 0,
            end: 10,
            handleIcon: 'M10.7,11.9v-1.3H9.3v1.3c-4.9,0.3-8.8,4.4-8.8,9.4c0,5,3.9,9.1,8.8,9.4v1.3h1.3v-1.3c4.9-0.3,8.8-4.4,8.8-9.4C19.5,16.3,15.6,12.2,10.7,11.9z M13.3,24.4H6.7V23h6.6V24.4z M13.3,19.6H6.7v-1.4h6.6V19.6z',
            handleSize: '80%',
            handleStyle: {
                color: '#fff',
                shadowBlur: 3,
                shadowColor: 'rgba(0, 0, 0, 0.6)',
                shadowOffsetX: 2,
                shadowOffsetY: 2
            }
        }],
        series: [
            {
                name: '持有钻石',
                type: 'line',
                smooth: true,
                symbol: 'none',
                sampling: 'average',
                itemStyle: {
                    color: 'rgb(255, 70, 131)'
                },
                areaStyle: {
                    color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [{
                        offset: 0,
                        color: 'rgb(255, 158, 68)'
                    }, {
                        offset: 1,
                        color: 'rgb(255, 70, 131)'
                    }])
                },
                data: data
            }
        ]
    };
    ;
    if (option && typeof option === "object") {
        myChart.setOption(option, true);
    }
}