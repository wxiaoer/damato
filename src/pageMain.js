const {
    ipcRenderer
} = require('electron')

// 全局变量
var notifyTimer;
var newSubTaskTemplate = {
    'id': 0,
    'alarmTime': '09:00:00',
    'continueTime': '00:15:00',
    'weatherAlarm': true,
    'status': '',
    'startTime': '',
    'timeClassify': ''
};
var newTaskTemplate = {
    'editTaskTimes': 1,
    'editTaskContinueTime': '00:15:00',
    'id': '',
    'title': '',
    'subTitle': '',
    'subTasks': [newSubTaskTemplate]
};

var app = new Vue({
    el: '#app',
    mounted: function () {
        Metro.init()
    },
    data: {
        currentPage: 0,
        damato: '',
        timeClassifys: [
            ['morning', {
                'start': '06:00:00',
                'end': '09:00:00'
            }],
            ['foreNoon', {
                'start': '09:00:00',
                'end': '12:00:00'
            }],
            ['noon', {
                'start': '12:00:00',
                'end': '14:00:00'
            }],
            ['afterNoon', {
                'start': '14:00:00',
                'end': '19:00:00'
            }],
            ['night', {
                'start': '19:00:00',
                'end': '24:00:00'
            }],
            ['other', {
                'start': '00:00:00',
                'end': '06:00:00'
            }]
        ],
        editTask: newTaskTemplate,
        doTask: '',
        doSubTask: '',
        archivedDamatos: '',
        viewDamatos: '',
        viewDetailDamato: '',
        archivedDamatosMaxDate: '',
        archivedDamatosMinDate: '',
        feedBackText: '',
    },
    created: function () {
        // 加载 damato 数据
        this.damato = require('electron').ipcRenderer.sendSync('damatoLoad')
        // 计算最近任务
        this.nearestSubTaskTimeNotifier()
    },
    watch: {
        'editTask.editTaskTimes': {
            deep: true,
            handler: function (newVal) {
                // 监控 task time 变化增减subtasks
                var currentSubTasksLength = this.editTask.subTasks.length
                if (currentSubTasksLength > newVal) {
                    for (var i = 0; i < currentSubTasksLength - newVal; i++) {
                        this.editTask.subTasks.pop()
                    }
                } else if (currentSubTasksLength < newVal) {
                    for (var i = 0; i < newVal - currentSubTasksLength; i++) {
                        var newSubTask = JSON.parse(JSON.stringify(newSubTaskTemplate))
                        newSubTask.continueTime = this.editTask.editTaskContinueTime
                        newSubTask.id = this.editTask.subTasks.length
                        this.classifyTime(newSubTask)
                        this.editTask.subTasks.push(newSubTask)
                    }
                }
            }
        },
    },
    methods: {
        tasksFinishedStatus: function (damato) {
            var finishedCount = 0
            var unFinishedCount = 0
            for (task of damato.tasks) {
                finishedCount += this.taskFinishedStatus(task).finishedCount
                unFinishedCount += this.taskFinishedStatus(task).unFinishedCount
            }
            return {
                'finishedCount': finishedCount,
                'unFinishedCount': unFinishedCount
            };
        },
        taskFinishedStatus: function (task) {
            var finishedCount = 0
            var unFinishedCount = 0
            var finishedTime = 0
            var unFinishedTime = 0
            for (subTask of task.subTasks) {
                if (subTask.status === 'finished') {
                    finishedCount++
                    finishedTime += timeToSeconds(subTask.continueTime)
                } else {
                    unFinishedCount++
                    unFinishedTime += timeToSeconds(subTask.continueTime)
                }
            }
            return {
                'finishedCount': finishedCount,
                'unFinishedCount': unFinishedCount,
                'finishedTime': finishedTime,
                'unFinishedTime': unFinishedTime
            }
        },
        editTaskSave: function () {
            if (!this.editTaskValidate()) {
                Metro.toast.create("Please fill in title info.", null, 5000, "alert")
                return false
            }
            var editTask = JSON.parse(JSON.stringify(this.editTask))
            if (editTask.id === '') {
                editTask.id = this.damato.tasks.length
                let tempTasks = JSON.parse(JSON.stringify(this.damato.tasks))
                tempTasks.push(editTask)
                this.damato.tasks = tempTasks
            } else {
                let tempTasks = JSON.parse(JSON.stringify(this.damato.tasks))
                for (var i = 0; i < tempTasks.length; i++) {
                    if (tempTasks[i].id === editTask.id) {
                        tempTasks[i] = editTask
                    }
                }
                this.damato.tasks = tempTasks
            }
            this.nearestSubTaskTimeNotifier()
            this.$forceUpdate()
            this.toggleCharms()
        },
        editTaskValidate: function () {
            if (this.editTask.title === '') {
                return false
            }
            return true
        },
        taskEdit: function (task) {
            this.editTask = JSON.parse(JSON.stringify(task))
            if (!$(newTask_btn).hasClass('active')) {
                this.toggleCharms()
            }
        },
        taskDelete: function () {
            var tasks = this.damato.tasks
            var editTask = this.editTask
            var toggleCharms = this.toggleCharms
            Metro.dialog.create({
                title: "Delete this task",
                content: "<div>This is a irrevocable option!</div>",
                actions: [{
                        caption: "Delete",
                        cls: "js-dialog-close alert",
                        onclick: function () {
                            for (var i = 0; i < tasks.length; i++) {
                                if (tasks[i].id === editTask.id) {
                                    tasks.splice(i, 1)
                                    app.damato.tasks = tasks
                                    app.nearestSubTaskTimeNotifier()
                                    app.$forceUpdate()
                                    break
                                }
                            }
                            toggleCharms()
                        }
                    },
                    {
                        caption: "Cancel",
                        cls: "js-dialog-close",
                        onclick: function () {
                            return true
                        }
                    }
                ]
            })

        },
        toggleCharms: function () {
            $(newTask_btn).toggleClass('active')
            $(editTask_charm).data('charms').toggle()
        },
        newTaskInit: function () {
            // 初始化new task 值
            this.editTask = JSON.parse(JSON.stringify(newTaskTemplate))
            // this.$forceUpdate();
        },
        classifyTime: function (subTask) {
            for (timeClassify of this.timeClassifys) {
                if (subTask.alarmTime >= timeClassify[1].start && subTask.alarmTime < timeClassify[1].end) {
                    subTask.timeClassify = timeClassify[0]
                    break
                }
            }
        },
        hasClassify: function (timeClassify, subTasks) {
            for (subTask of subTasks) {
                if (subTask.timeClassify === timeClassify) {
                    return true
                }
            }
            return false
        },
        taskNearestSubTask: function (task) {
            var date = new Date()
            var year = date.getFullYear()
            var month = date.getMonth() + 1
            var day = date.getDate()
            var currentDate = year + '-' + month + '-' + day
            var currentTime = date.getTime()
            var subTaskNearSet = []
            for (subTask of task.subTasks) {
                if (subTask.status != 'finished') {
                    var taskAlarmDateStr = currentDate + ' ' + subTask.alarmTime
                    var taskAlarmDate = new Date(taskAlarmDateStr)
                    var taskAlarmTime = taskAlarmDate.getTime()
                    subTaskNearSet.push([subTask, Math.abs(taskAlarmTime - currentTime), subTask.alarmTime])
                }
            }
            if (subTaskNearSet.length === 0) {
                return ''
            }
            subTaskNearSet = subTaskNearSet.slice().sort(function (a, b) {
                return a[1] - b[1]
            });
            return subTaskNearSet[0][0]
        },
        sortSubTask: function (subTasks) {
            return subTasks.slice().sort(function (a, b) {
                return (new Date().format("%d-%m-%Y ") + a.alarmTime).toDate("dd-mm-yyyy hh:ii:ss").getTime() - (new Date().format("%d-%m-%Y ") + b.alarmTime).toDate("dd-mm-yyyy hh:ii:ss").getTime()
            })
        },
        allTaskNearestSubTask: function () {
            if (this.damato.tasks.length === 0) {
                return '';
            }
            var date = new Date();
            var year = date.getFullYear();
            var month = date.getMonth() + 1;
            var day = date.getDate();
            var currentDate = year + '-' + month + '-' + day;
            var currentTime = date.getTime();
            var subTaskNearSet = [];
            for (task of this.damato.tasks) {
                for (subTask of task.subTasks) {
                    if (subTask.status != 'finished') {
                        var taskAlarmDateStr = currentDate + ' ' + subTask.alarmTime;
                        var taskAlarmDate = new Date(taskAlarmDateStr);
                        var taskAlarmTime = taskAlarmDate.getTime();
                        var timeDistance = taskAlarmTime - currentTime;
                        subTaskNearSet.push([subTask, Math.abs(timeDistance), subTask.alarmTime, task]);
                    }
                }
            }
            subTaskNearSet = subTaskNearSet.slice().sort(function (a, b) {
                return a[1] - b[1]
            });
            if (subTaskNearSet.length === 0) {
                return '';
            }
            return [subTaskNearSet[0][0], subTaskNearSet[0][3], subTaskNearSet[0][1]];
        },
        allTaskNearestComingSubTask: function () {
            if (this.damato.tasks.length === 0) {
                return '';
            }
            var date = new Date();
            var year = date.getFullYear();
            var month = date.getMonth() + 1;
            var day = date.getDate();
            var currentDate = year + '-' + month + '-' + day;
            var currentTime = date.getTime();
            var subTaskNearSet = [];
            for (task of this.damato.tasks) {
                for (subTask of task.subTasks) {
                    if (subTask.status != 'finished' && subTask.weatherAlarm) {
                        var taskAlarmDateStr = currentDate + ' ' + subTask.alarmTime;
                        var taskAlarmDate = new Date(taskAlarmDateStr);
                        var taskAlarmTime = taskAlarmDate.getTime();
                        var timeDistance = taskAlarmTime - currentTime;
                        if (timeDistance > 0) {
                            subTaskNearSet.push([subTask, timeDistance, subTask.alarmTime, task]);
                        }
                    }
                }
            }
            subTaskNearSet = subTaskNearSet.slice().sort(function (a, b) {
                return a[1] - b[1]
            });
            if (subTaskNearSet.length === 0) {
                return '';
            }
            return [subTaskNearSet[0][0], subTaskNearSet[0][3], subTaskNearSet[0][1]];
        },
        subTaskDo: function (subTask, task) {
            // alert(JSON.stringify(subTask));
            if (subTask.length === 0) {
                var notify = Metro.notify;
                notify.setup({
                    distance: 50,
                    width: 300,
                    duration: 1000,
                    animation: 'easeOutCubic'
                });
                notify.create("Congratulate! Todays [ " + task.title + " ] task has already been finished!", "", {
                    cls: "success"
                });
                notify.reset();
            }
            var now = new Date();
            subTask.startTime = now.getTime();
            this.doSubTask = subTask;
            this.doTask = task;
        },
        taskFinish: function () {
            // count down component will finished icorrectely
            if ($('#countDown').data('countdown').getLeft().days === 0 && $('#countDown').data('countdown').getLeft().hours === 0 && $('#countDown').data('countdown').getLeft().minutes === 0 && $('#countDown').data('countdown').getLeft().seconds === 0) {
                this.doSubTask.status = 'finished';
                var notify = Metro.notify;
                notify.setup({
                    width: 300,
                    duration: 1000,
                    animation: 'easeOutBounce'
                });
                notify.create(this.doTask.title + " finished!", "");
                notify.reset();
                new Notification(this.doTask.title + " finished!", {
                    body: this.doTask.title + " " + this.doTask.subTitle + " finished!"
                });
                this.doSubTask = '';
                this.doTask = '';
                this.$forceUpdate();
            }
        },
        feedBackSubmit: function () {
            if (this.feedBackText) {
                let data = require('electron').ipcRenderer.sendSync('damatoFeedBack', this.feedBackText);
                if (data.result == false) {
                    Metro.toast.create("Feedback failed : " + data.reason, null, 5000, "error");
                } else {
                    Metro.toast.create("Feedback success, thanks for your attation.", null, 5000, "info");
                    this.feedBackText = ''
                }
            }
        },
        nearestSubTaskTimeNotifier: function () {
            clearTimeout(notifyTimer);
            var allTaskNearestSubTask = this.allTaskNearestComingSubTask();
            if (allTaskNearestSubTask.length > 0) {
                console.log("nearest sub task time distance" + allTaskNearestSubTask[2]);
                console.log("nearest sub task alarm time" + allTaskNearestSubTask[0].alarmTime);
                notifyTimer = setTimeout(function () {
                    new Notification(allTaskNearestSubTask[1].title, {
                        body: allTaskNearestSubTask[1].subTitle
                    });
                    app.nearestSubTaskTimeNotifier();
                }, allTaskNearestSubTask[2]);
            }
            this.$forceUpdate();
        },
        deleteSubTask: function (subTaskIndex) {
            this.editTask.subTasks.splice(subTaskIndex, 1);
            this.editTask.editTaskTimes--;
        },
        computeArchivedDamatoMaxMin: function () {
            let arr = [];
            if (this.archivedDamatos.length == 0) {
                this.archivedDamatosMaxDate = new Date().getTime()
                this.archivedDamatosMinDate = new Date().getTime()
                return
            }
            for (let i in this.archivedDamatos) {
                arr.push(i)
            };

            function sortDateF(dateA, dateB) {
                return (dateB.split("-")[0] * 12 * 30 + dateB.split("-")[1] * 12 + dateB.split("-")[2]) - (dateA.split("-")[0] * 12 * 30 + dateA.split("-")[1] * 12 + dateA.split("-")[2])
            }
            arr.sort(sortDateF);
            this.archivedDamatosMaxDate = arr[0]
            this.archivedDamatosMinDate = arr[arr.length - 1]
        },
        initAnalysePage: function () {
            // 加载 archived damato 数据
            this.archivedDamatos = require('electron').ipcRenderer.sendSync('archivedDamatosLoad');
            this.loadViewDamatos(new Date());
            this.viewDetailDamato = this.viewDamatos[new Date().toLocaleDateString()];
            // 计算最近最远damato
            this.computeArchivedDamatoMaxMin();
            // 统计图初始化
            // 周统计视图初始化
            var weekCtx = document.getElementById("chart_week").getContext("2d");
            var data = {
                labels: ["Mon", "Tues", "Wed", "Thur", "Fri", "Sat", "Sun"],
                datasets: [{
                        label: "Task finished count",
                        backgroundColor: [
                            'rgba(153, 102, 255, 0.2)',
                            'rgba(153, 102, 255, 0.2)',
                            'rgba(153, 102, 255, 0.2)',
                            'rgba(153, 102, 255, 0.2)',
                            'rgba(153, 102, 255, 0.2)',
                            'rgba(153, 102, 255, 0.2)'
                        ],
                        borderColor: [
                            'rgba(153, 102, 255, 1)',
                            'rgba(153, 102, 255, 1)',
                            'rgba(153, 102, 255, 1)',
                            'rgba(153, 102, 255, 1)',
                            'rgba(153, 102, 255, 1)',
                            'rgba(153, 102, 255, 1)'
                        ],
                        data: [65, 59, 80, 81, 56, 55, 40]
                    },
                    {
                        label: "Task unfinished count",
                        data: [28, 48, 40, 19, 86, 27, 90]
                    }
                ]
            };
            weekChart = new Chart(weekCtx, {
                type: 'bar',
                data: data,
            })
            $(chart_week).on("click", function (evt) {
                var activeBars = weekChart.getElementAtEvent(evt);
                if (activeBars.length > 0) {
                    var datasetsIndex = activeBars[0]._datasetIndex;
                    var barIndex = activeBars[0]._index;
                    var startDate = getFirstDayOfWeek(new Date(app.viewDetailDamato.createTime));
                    var viewDate = dateChange(barIndex, new Date(startDate));
                    app.updateChartData(viewDate);
                }
                // => activeBars is an array of bars on the canvas that are at the same position as the click event.
            })
            // 日统计视图初始化
            var dayCtx = document.getElementById("chart_day").getContext("2d");
            var data = {
                labels: ["Mon", "Tues", "Wed", "Thur", "Fri", "Sat", "Sun"],
                datasets: [{
                        label: "Task finished count",
                        backgroundColor: [
                            'rgba(153, 102, 255, 0.2)',
                            'rgba(153, 102, 255, 0.2)',
                            'rgba(153, 102, 255, 0.2)',
                            'rgba(153, 102, 255, 0.2)',
                            'rgba(153, 102, 255, 0.2)',
                            'rgba(153, 102, 255, 0.2)'
                        ],
                        borderColor: [
                            'rgba(153, 102, 255, 0.2)',
                            'rgba(153, 102, 255, 0.2)',
                            'rgba(153, 102, 255, 0.2)',
                            'rgba(153, 102, 255, 0.2)',
                            'rgba(153, 102, 255, 0.2)',
                            'rgba(153, 102, 255, 0.2)'
                        ],
                        data: [65, 59, 80, 81, 56, 55, 40]
                    },
                    {
                        label: "Task unfinished count",
                        data: [28, 48, 40, 19, 86, 27, 90]
                    }
                ]
            };
            dayChart = new Chart(dayCtx, {
                type: 'bar',
                data: data,
            });
            this.updateChartData();
        },
        loadViewDamatos: function (queryDate) {
            var targetDamatos = new Object();
            var startDate = getFirstDayOfWeek(new Date(queryDate))
            var startDateFormat = startDate.toLocaleDateString()
            var queryDate = new Date(queryDate);
            targetDamatos[startDateFormat] = undefined
            if (this.archivedDamatos[startDateFormat] === undefined && startDate < new Date()) {
                let arr = [];
                for (let i in this.archivedDamatos) {
                    arr.push(i)
                };
                // function sortDateF(dateA, dateB) {
                //     return (dateB.split("-")[0] * 12 * 30 + dateB.split("-")[1] * 12 + dateB.split("-")[2]) - (dateA.split("-")[0] * 12 * 30 + dateA.split("-")[1] * 12 + dateA.split("-")[2])
                // }
                arr.sort();
                for (let i of arr) {
                    // if (sortDateF(i, startDateFormat) > 0) {
                    if (new Date(i) < startDate) {
                        targetDamatos[startDateFormat] = cleanFinisheStatus(this.archivedDamatos[i], startDateFormat);
                        break;
                    }
                }
            } else {
                targetDamatos[startDateFormat] = this.archivedDamatos[startDateFormat]
            }
            for (var i = 1; i < 7; i++) {
                var currentDate = dateChange(i, startDate)
                if (this.archivedDamatos[currentDate] === undefined && new Date(currentDate) <= new Date()) {
                    if (currentDate == new Date().toLocaleDateString()) {
                        targetDamatos[currentDate] = this.damato;
                    } else {
                        targetDamatos[currentDate] = cleanFinisheStatus(targetDamatos[dateChange(i - 1, startDate)], currentDate);
                    }
                } else {
                    targetDamatos[currentDate] = this.archivedDamatos[currentDate];
                }
            }
            this.viewDamatos = targetDamatos;
            this.viewDetailDamato = targetDamatos[queryDate.toLocaleDateString()];
        },
        viewDamatosCount: function () {
            var finishedCount = [];
            var unFinishedCount = [];
            for (damato in this.viewDamatos) {
                if (this.viewDamatos[damato] != undefined) {
                    var damatoFinishedCount = this.tasksFinishedStatus(this.viewDamatos[damato])["finishedCount"];
                    var damatoUnFinishedCount = this.tasksFinishedStatus(this.viewDamatos[damato])["unFinishedCount"];
                    finishedCount.push(damatoFinishedCount);
                    unFinishedCount.push(damatoUnFinishedCount);
                } else {
                    finishedCount.push(0);
                    unFinishedCount.push(0);
                }
            }
            return {
                "finishedCount": finishedCount,
                "unFinishedCount": unFinishedCount
            };
        },
        viewTasksCount: function () {
            var finishedCount = []
            var unFinishedCount = []
            var labels = []
            if (this.viewDetailDamato == undefined) {
                return {
                    "finishedCount": finishedCount,
                    "unFinishedCount": unFinishedCount,
                    "labels": labels
                }
            }
            for (task of this.viewDetailDamato.tasks) {
                if (task != undefined) {
                    var damatoFinishedCount = this.taskFinishedStatus(task)["finishedCount"]
                    var damatoUnFinishedCount = this.taskFinishedStatus(task)["unFinishedCount"]
                    finishedCount.push(damatoFinishedCount)
                    unFinishedCount.push(damatoUnFinishedCount)
                    labels.push(task.title)
                }
            }
            return {
                "finishedCount": finishedCount,
                "unFinishedCount": unFinishedCount,
                "labels": labels
            }
        },
        updateChartData: function (date = false) {
            if (date) {
                this.loadViewDamatos(date)
            }
            weekChart.data.datasets[0].data = this.viewDamatosCount()["finishedCount"]
            weekChart.data.datasets[1].data = this.viewDamatosCount()["unFinishedCount"]
            weekChart.update()
            dayChart.data.labels = this.viewTasksCount()["labels"]
            dayChart.data.datasets[0].data = this.viewTasksCount()["finishedCount"]
            dayChart.data.datasets[1].data = this.viewTasksCount()["unFinishedCount"]
            dayChart.update()
        },
        viewDayChange: function (dataModifyDay) {
            var changeToDate = dateChange(dataModifyDay, new Date(app.viewDetailDamato.createTime));
            if (new Date(changeToDate) > new Date()) {
                this.updateChartData(new Date());
            } else if (new Date(changeToDate) < new Date(this.archivedDamatosMinDate)) {
                this.updateChartData(new Date(this.archivedDamatosMinDate));
            } else {
                this.updateChartData(new Date(changeToDate));
            }
        },
        donate: function () {
            var html_content =
                '<div class="img-container" style="widht:100px"><img src="alipay.jpg"></div>' +
                '<div class="img-container" style="widht:100px"><img src="wechat.jpg"></div>'+
                "<p>Lorem Ipsum is simply dummy text...</p>";
            Metro.infobox.create(html_content);
        }
    }
})

/* 日期时间操作函数 */
// 日期加减天
function dateChange(num = 0, date = false) {
    if (!date) {
        date = new Date() //没有传入值时,默认是当前日期
    }
    date = Date.parse(date) / 1000 //转换为时间戳
    date += (86400) * num //修改后的时间戳
    var newDate = new Date(parseInt(date) * 1000) //转换为时间
    return newDate.toLocaleDateString()
}

// 获取日期所在周的周一日期
function getFirstDayOfWeek(date) {
    var resultDate = date
    var weekday = resultDate.getDay() || 7 //获取星期几,getDay()返回值是 0（周日） 到 6（周六） 之间的一个整数。0||7为7，即weekday的值为1-7
    resultDate.setDate(resultDate.getDate() - weekday + 1) //往前算（weekday-1）天，年份、月份会自动变化
    return resultDate
}

// 时间转秒
function timeToSeconds(timeS) {
    return timeS.split(":")[0] * 3600 + timeS.split(":")[1] * 60 + timeS.split(":")[2] * 1
}

// 数字补位
function formatZero(num, len) {
    if (String(num).length > len) return num;
    return (Array(len).join(0) + num).slice(-len);
}

// 秒转时间
function secondsToTime(seconds) {
    return formatZero(Math.floor(seconds / 3600), 2) + ":" + formatZero(Math.floor(seconds % 3600 / 60), 2) + ":" + formatZero(seconds % 3600 % 60, 2)
}

// 清除 damato 任务完成状态
function cleanFinisheStatus(damato, damatoDate) {
    if (damato == undefined) {
        return damato
    }
    var resultDamato = JSON.parse(JSON.stringify(damato))
    for (task of resultDamato.tasks) {
        for (subTask of task.subTasks) {
            if (subTask.status == 'finished') {
                subTask.status = ''
                subTask.startTime = ''
            }
        }
    }
    resultDamato.createTime = damatoDate
    return resultDamato
}