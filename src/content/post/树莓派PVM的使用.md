---
title: 树莓派PVM的使用
publishDate: 2023-09-19 23:55:10
description: ' 利用树莓派中python GPIO库实现PVM'
language: '中文'
tags:
  - 树莓派
  - PVM
  - 云台
  - 舵机
---

# 树莓派PVM的使用
上方舵机角度范围为0～180
下方为0～270（角度高了点线会缠绕）
(可以为负数，但是超过了某范围会自动复位)
以下为代码
## RPI.GPIO
~~~python
  

import RPi.GPIO as GPIO

from time import sleep

  

def tonum1(degree): # 用于处理角度转换的函数

dc = float(degree)/18+2.5

return dc

def tonum(degree): # 用于处理角度转换的函数

dc = float(degree)/27+2.5

return dc

# dc = 1/27*角度 + 2.5

  

servopin1 = 17 #舵机1,方向为左右转

servopin2 = 18 #舵机2,方向为上下转

  

GPIO.setmode(GPIO.BCM)

GPIO.setup(servopin1, GPIO.OUT, initial=False)

GPIO.setup(servopin2, GPIO.OUT, initial=False)

p1 = GPIO.PWM(servopin1,50) #50HZ

p2 = GPIO.PWM(servopin2,50) #50HZ

  

p1.start(tonum1(90)) #初始化角度

p2.start(tonum(40)) #初始化角度

sleep(0.5)

p1.ChangeDutyCycle(0) #清除当前占空比，使舵机停止抖动

p2.ChangeDutyCycle(0) #清除当前占空比，使舵机停止抖动

sleep(0.1)

  
  

def left(r):

# if r >= 0:

print('当前角度为',r)

p1.ChangeDutyCycle(tonum1(r)) #执行角度变化

sleep(0.1)

p1.ChangeDutyCycle(0) #清除当前占空比，使舵机停止抖动

sleep(0.01)

#else:

# print('\n**超出范围**\n')

# r = 90

# p1.ChangeDutyCycle(tonum(r)) #执行角度变化

# sleep(0.1)

# p1.ChangeDutyCycle(0) #清除当前占空比，使舵机停止抖动

# sleep(0.01)

  

def up(l):

#if l > 0:

print('当前角度为',l)

p2.ChangeDutyCycle(tonum(l)) #执行角度变化，

sleep(0.1)

p2.ChangeDutyCycle(0) #清除当前占空比，使舵机停止抖动

sleep(0.01)

# else:

#print('\n**超出范围**\n')

#l=45

#p2.ChangeDutyCycle(tonum(l)) #执行角度变化

#sleep(0.1)

#p2.ChangeDutyCycle(0) #清除当前占空比，使舵机停止抖动

# sleep(0.01)

  
  

if __name__ == '__main__':

while True:

r = int(input('input 1 angle:'))

l = int(input('input 2 angle:'))

left(r)

up(l)

#1 is 180,2 is 270

~~~
## pigpio
$\quad$ 因为RPI.GPIO库无法实现remote GPIO，修改为pigpio
$\quad$ 使用前在树莓派的/首选项/Raspberry Pi Configuration中启用remote GPIO

~~~python
#coding=UTF-8

import pigpio

from time import sleep

  

pi = pigpio.pi('10.6.28.31')

if not pi.connected:

print('connect fail')

  

def tonum1(degree): # 用于上方舵机处理角度转换的函数0~180

dc = float(degree)*1000/90+500

return dc

def tonum2(degree): # 用于下方舵机处理角度转换的函数0~270

dc = float(degree)*1000/(45*3)+500

return dc

  
  

servopin1 = 17 #舵机1,方向为左右转

servopin2 = 18 #舵机2,方向为上下转

  

pi.set_PWM_frequency(servopin1,50)

pi.set_PWM_frequency(servopin2,50)# frequency = 50Hz

  

sleep(0.5)

  
  

pi.set_servo_pulsewidth(servopin1, tonum1(0))

pi.set_servo_pulsewidth(servopin2, tonum2(0))#初始角度两个0

sleep(0.5)

  
  

def left(r):

if r <= 180:

print('当前角度为',r)

pi.set_servo_pulsewidth(servopin1,tonum1(r)) #执行角度变化

sleep(0.1)

else:

print('\n**超出范围**\n')

pi.set_servo_pulsewidth(servopin1,tonum1(0))

sleep(0.01)

  

def up(l):

if l <= 270:

print('当前角度为',l)

pi.set_servo_pulsewidth(servopin2,tonum2(l))#执行角度变化，

sleep(0.1)

else:

print('\n**超出范围**\n')

pi.set_servo_pulsewidth(servopin2,tonum2(0))

sleep(0.01)

  
  

if __name__ == '__main__':

while True:

r = float(input('input 1 angle:'))

l = float(input('input 2 angle:'))

up(l)

left(r)

#1 is 180,2 is 270
~~~

---