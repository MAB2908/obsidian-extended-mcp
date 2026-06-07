v0.2b: 
---
title: "Backpropagation"
date: 2026-05-10
tags: [concept, ai, ml, math]
status: evergreen
---

# Backpropagation

> Алгоритм обратного распространения ошибки для обучения нейронных сетей.

## Суть
1. Прямой проход: вычисляем предсказание
2. Вычисление ошибки: сравниваем с целевым значением
3. Обратный проход: распространяем градиент от выхода к входу
4. Обновление весов: градиентный спуск

## Формула
$$\frac{\partial L}{\partial w} = \frac{\partial L}{\partial a} \cdot \frac{\partial a}{\partial z} \cdot \frac{\partial z}{\partial w}$$

## Связи
- [[neural-networks]] — базовая архитектура
- [[gradient-descent]] — метод оптимизации
- [[automatic-differentiation]] — вычисление градиентов
